#!/usr/bin/env node
// STEP 3 — BUILD THE AUDIO FOR AN EPISODE.
//
//   node scripts/lt-tv-audio.mjs content/lt-tv/episodes/news-2026-W38.json
//
// An episode runs five to ten minutes. One text-to-dialogue request does not,
// reliably, past about two thousand characters — so the episode is generated
// as several blocks, each a whole conversation in context, and the blocks are
// joined into the single pair of tracks the runtime already plays. Nothing
// about playback changes; there are still two SitePal clips per episode.
//
// WHY PCM AND NOT MP3. The design this replaces concatenated mp3 block
// masters with ffmpeg. That is wrong in a way that would not show up until
// the back half of an episode: every mp3 frame boundary carries encoder delay
// and padding, so each join inserts a few milliseconds of silence that the
// timestamps know nothing about. The scheme rests on
//
//     global_start(line) = Σ duration(preceding blocks) + local_start(line)
//
// so that error accumulates block by block and the picture drifts against the
// dialogue — the same symptom as a mistuned lead-in, and much harder to find.
// Requesting pcm_44100 makes a join exact to the sample, and as a side effect
// removes ffmpeg from this step entirely: raw PCM concatenates by appending
// bytes, and a block's duration is its byte count, not an estimate.
//
// WHAT THIS DOES NOT DO. Splitting the master into the two balanced tracks is
// `elevenlabs-dialogue-test/process_dialogue.py`, which already exists, is
// already proven, and needs ffmpeg. This writes the master and the merged
// segment list it expects and then hands off.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { createHash } from "node:crypto";

import { uploadPlan } from "./lt-tv-split.mjs";
import { CAST } from "./lt-tv-format.mjs";
import { pendingEdits, summariseEdits, readPauseMarks } from "./lt-tv-edit.mjs";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps";

// ── the PCM assumption, made self-checking ────────────────────────────────
//
// ElevenLabs PCM is 16-bit signed little-endian mono at whatever rate was
// asked for. Every duration below is computed from that, so if it is ever
// wrong every offset is wrong by the same ratio and the episode desyncs
// silently. It is not something this environment can verify, so instead of
// trusting it the run cross-checks each block's byte length against the last
// timestamp ElevenLabs itself reported for that block. A wrong assumption
// fails loudly on block one rather than quietly at minute four.
//
// THE RATE IS AN ACCOUNT FACT, NOT AN EPISODE ONE. 44.1kHz PCM is a Pro-tier
// format, and an account below that tier is refused it outright. Any other
// PCM rate is allowed, and the design does not care which: the joins are still
// sample-exact and a block's duration is still its byte count. So the rate is
// settable and everything derives from it. Speech at 24kHz carries 12kHz of
// bandwidth, which is more than a voice uses, and SitePal re-encodes the
// upload anyway.
export const PCM_RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000];
export const PCM = { sampleRate: rateFromEnv(), channels: 1, bytesPerSample: 2 };

/** The configured rate, or the default, refusing anything ElevenLabs has no name for. */
function rateFromEnv() {
  const raw = process.env.LT_TV_PCM_RATE;
  if (!raw) return 44100;
  const rate = Number(raw);
  if (!PCM_RATES.includes(rate)) {
    throw new Error(
      `LT_TV_PCM_RATE=${raw} is not a rate ElevenLabs offers. ` +
        `Pick one of: ${PCM_RATES.join(", ")}.`,
    );
  }
  return rate;
}

/**
 * A BEAT BETWEEN ACTS, because blocks were butted together with nothing.
 *
 * An episode is generated as several blocks, and `packBlocks` only ever breaks
 * at an act boundary — so every join between two blocks is also a join between
 * two acts of the show. They were concatenated with no gap at all, which is why
 * "I had jokes prepared." ran straight into "Here is the part people flinch
 * at.": two separate requests, laid end to end to the byte, across what should
 * be the biggest pause in the episode.
 *
 * Silence here is exact and free. It is raw PCM, so a beat is a known number of
 * zero bytes, and the same number places every line after it — no estimate and
 * no ffmpeg. It also gives the section cutter real silence to land a join in,
 * at the one place an audience already expects a break.
 */
export const ACT_BEAT_SECONDS = beatFromEnv();

/** The configured beat, refusing a value that would read as a fault rather than a pause. */
function beatFromEnv() {
  const raw = process.env.LT_TV_ACT_BEAT;
  if (raw === undefined) return 0.7;
  const beat = Number(raw);
  if (!Number.isFinite(beat) || beat < 0 || beat > 3) {
    throw new Error(`LT_TV_ACT_BEAT=${raw} is not a number of seconds between 0 and 3.`);
  }
  return beat;
}

/**
 * A beat as a whole number of samples.
 *
 * Bytes rather than seconds is the point: the audio and the timings are then
 * derived from ONE integer and cannot disagree. A part-sample beat would put
 * every later line a fraction out, which is the failure this file is built to
 * avoid.
 */
export function beatBytes(seconds = ACT_BEAT_SECONDS) {
  const frame = PCM.channels * PCM.bytesPerSample;
  return Math.round((seconds * bytesPerSecond()) / frame) * frame;
}

/**
 * How long the longest pause anyone means may be. A `# pause 30s` is a typo,
 * and a typo here is half a minute of dead air in a recorded episode.
 */
export const PAUSE_MARK_MAX_SECONDS = 10;

/**
 * Render this episode in the voices the show has NOW, not the ones it was
 * written with.
 *
 * A record stores a `voiceId` on every line and in its `cast`, both frozen
 * when the episode was assembled. That is a copy of a fact that lives in
 * `CAST`, and a copy goes stale: Michelle changed the Monk's voice on
 * 2026-09-21 and then re-recorded roundtable-02 — which dutifully asked
 * ElevenLabs for the OLD voice, because that is what the record still said.
 * Nothing caught it, because applying edits compares words and the words had
 * not changed.
 *
 * It surfaced one step later and looked like a different bug entirely: the
 * split refused with "No dialogue segments were found for voice ...", since
 * the processor matches speakers by the id the cast has today against a
 * recording made with yesterday's.
 *
 * A voice is a property of the show, so the show wins, and the record is
 * corrected to say what was actually rendered. The block fingerprint covers
 * voice ids, so anything cached under the old voice is re-recorded rather
 * than mixed in.
 */
export function revoice(episode) {
  const changes = [];
  const now = (actor, was) => {
    const voice = CAST[actor]?.voiceId;
    if (!voice || voice === was) return was ?? voice;
    if (!changes.some((c) => c.actor === actor)) {
      changes.push({ actor, was, now: voice, name: CAST[actor].displayName });
    }
    return voice;
  };

  const revoiced = {
    ...episode,
    segments: episode.segments.map((segment) => ({
      ...segment,
      lines: segment.lines.map((line) => ({ ...line, voiceId: now(line.actor, line.voiceId) })),
    })),
    cast: Object.fromEntries(
      Object.entries(episode.cast ?? {}).map(([actor, who]) => [
        actor,
        { ...who, voiceId: now(actor, who.voiceId) },
      ]),
    ),
  };

  return { episode: revoiced, changes };
}

/** The lines a recording block covers, in running order. */
export function blockLines(episode, block) {
  return episode.segments.filter((s) => block.segments.includes(s.id)).flatMap((s) => s.lines);
}

/** Every line number in the episode, in order. */
const lineNumbers = (episode) => episode.segments.flatMap((s) => s.lines.map((l) => l.n));

/**
 * What to actually ask ElevenLabs for, and how much silence to put between.
 *
 * WHY A PAUSE IS A SEAM AND NOT AN INSERT. Michelle asked for pauses she can
 * vary, including awkward ones played for a laugh, and ElevenLabs cannot give
 * her a measured one: text-to-dialogue runs on eleven_v3, and v3 does not
 * support the `<break time="1.5s" />` tag (that is real, but it belongs to the
 * older single-voice models — see PAUSE_MARK_RE in lt-tv-edit.mjs).
 *
 * We can, exactly, but only where we hold the seam. A block is one unbroken
 * render, so putting silence inside one would mean cutting it at a line
 * boundary ElevenLabs reported — and those reported boundaries are the open
 * suspect for lines that start in one voice and finish in the other. So
 * instead of cutting a render, a pause mark ENDS one: the block is recorded
 * as two requests, and the silence goes between them, where it is exact to
 * the sample and costs nothing.
 *
 * The price is honest and worth saying out loud: the half after the pause is
 * rendered without the half before it in context, so the delivery either side
 * of a pause can shift. That is the trade for an exact pause anywhere.
 */
export function renderPlan(episode, pauses = new Map(), { beat = ACT_BEAT_SECONDS } = {}) {
  const units = [];

  for (const block of episode.blocks) {
    const lines = blockLines(episode, block);
    if (!lines.length) throw new Error(`${block.id} has no lines`);

    // Split this block wherever the screenplay asks for a pause.
    const pieces = [];
    for (const line of lines) {
      const asked = pauses.get(line.n);
      if (asked !== undefined && !(asked >= 0 && asked <= PAUSE_MARK_MAX_SECONDS)) {
        throw new Error(
          `"# pause ${asked}s" in front of line ${line.n} is not a pause between 0 and ` +
            `${PAUSE_MARK_MAX_SECONDS} seconds.`,
        );
      }
      if (!pieces.length || asked !== undefined) pieces.push({ lines: [], asked, seconds: asked });
      pieces[pieces.length - 1].lines.push(line);
    }

    for (const [k, piece] of pieces.entries()) {
      const isFirstOfAll = units.length === 0;
      const asked = !isFirstOfAll && piece.asked !== undefined;
      const seconds = isFirstOfAll ? 0 : asked ? piece.seconds : beat;
      units.push({
        id: pieces.length === 1 ? block.id : `${block.id}${partSuffix(k)}`,
        block: block.id,
        parts: pieces.length,
        lines: piece.lines,
        firstLine: piece.lines[0].n,
        lastLine: piece.lines[piece.lines.length - 1].n,
        pauseBefore: seconds,
        bytes: beatBytes(seconds),
        asked,
      });
    }
  }

  return units;
}

/** a, b, c … for the parts of a split block, and a plain number past z. */
const partSuffix = (k) => (k < 26 ? String.fromCharCode(97 + k) : `-part${k + 1}`);

/** The request body for one render: its lines, in order, with voices. */
export function unitInputs(unit) {
  return unit.lines.map((line) => ({ text: line.text, voice_id: line.voiceId }));
}

/**
 * Pause marks with nowhere to go, so the run can say so rather than drop them.
 *
 * Silently ignoring one would be the same shape of fault as edits that were
 * saved but never applied: the page says one thing, the recording does
 * another, and nothing tells you until you play it.
 */
export function strandedPauses(episode, pauses = new Map()) {
  const ns = lineNumbers(episode);
  const known = new Set(ns);
  const first = ns[0];
  return [...pauses.keys()].filter((n) => !known.has(n) || n === first).sort((a, b) => a - b);
}

/** What to say about them, in terms of the page rather than of blocks. */
export function strandedWarning(stranded, episode) {
  if (!stranded.length) return null;
  const ns = lineNumbers(episode);
  const known = new Set(ns);
  const said = [];
  const missing = stranded.filter((n) => !known.has(n));
  if (missing.length) {
    said.push(
      `There is no line ${missing.join(", ")} in this episode, so the pause ` +
        `${missing.length === 1 ? "mark in front of it was" : "marks in front of them were"} ignored.`,
    );
  }
  if (stranded.includes(ns[0])) {
    said.push(
      `A pause in front of line ${ns[0]} is silence before the episode starts, which the ` +
        "lead-in already handles, so it was ignored.",
    );
  }
  return said.join("\n");
}

/** Bytes of PCM per second at the configured rate. Read, never cached — the rate moves. */
const bytesPerSecond = () => PCM.sampleRate * PCM.channels * PCM.bytesPerSample;

/** Seconds of audio in a raw PCM buffer of this format. */
export function pcmSeconds(byteLength) {
  return byteLength / bytesPerSecond();
}

/**
 * Does the audio we decoded match the timings ElevenLabs sent with it?
 *
 * A block's audio must be at least as long as its last spoken word, and not
 * absurdly longer. Getting the sample rate, channel count or sample width
 * wrong scales the computed duration by 2x, 4x or 0.5x, which this catches;
 * a trailing pause of a second or two, which is normal, it does not.
 */
export function pcmLooksRight(byteLength, segments) {
  const seconds = pcmSeconds(byteLength);
  const lastEnd = Math.max(0, ...segments.map((s) => Number(s.end_time_seconds) || 0));
  if (!lastEnd) return { ok: true, seconds };
  const ok = seconds >= lastEnd - 0.05 && seconds <= lastEnd + 15;
  return { ok, seconds, lastEnd };
}

// ── the arithmetic this whole step rests on ───────────────────────────────

/**
 * Lay the blocks end to end on one timeline.
 *
 * Each block is generated on its own, so its timestamps start from zero. A
 * block that plays third begins at the summed duration of the two before it,
 * and every timestamp inside it shifts by that much. Pure, so the sums can be
 * checked without generating a single second of audio.
 *
 * @param blocks  [{ id, byteLength, segments }] in playing order
 * @param gapBytes silence inserted BETWEEN blocks, in bytes — see beatBytes.
 *                 The same number of bytes goes into the master, so the two
 *                 cannot drift apart.
 * @param gaps     per-join byte counts, when the joins differ — see renderPlan.
 *                 One entry per join, so `gaps[0]` is the pause between the
 *                 first block and the second. Falls back to gapBytes.
 * @returns { segments, durationSeconds, blocks: [{ id, offsetSeconds, durationSeconds }] }
 */
export function mergeBlocks(blocks, { gapBytes = 0, gaps = [] } = {}) {
  const segments = [];
  const placed = [];
  let offset = 0;

  for (const [index, block] of blocks.entries()) {
    if (index > 0) offset += pcmSeconds(gaps[index - 1] ?? gapBytes);
    const duration = pcmSeconds(block.byteLength);
    for (const segment of block.segments) {
      segments.push({
        ...segment,
        start_time_seconds: round(Number(segment.start_time_seconds) + offset),
        end_time_seconds: round(Number(segment.end_time_seconds) + offset),
      });
    }
    placed.push({
      id: block.id,
      offsetSeconds: round(offset),
      durationSeconds: round(duration),
    });
    offset += duration;
  }

  return { segments, durationSeconds: round(offset), blocks: placed };
}

/**
 * WHY `alignment` CANNOT PLACE A BOUNDARY. Read this before trying it again.
 *
 * The with-timestamps response carries an `alignment`: a start and an end for
 * every character of the script, plus `character_start_index` /
 * `character_end_index` per line. It reads like the exact answer to "where
 * does this line really stop", and on 2026-09-21 a whole fix was built on it.
 * It is useless for this, and not because of any one recording.
 *
 * Measured against the archived July response in `elevenlabs-dialogue-test/`:
 *
 *   - the alignment is CONTINUOUS — character k's end is character k+1's
 *     start, at all 825 characters, with no gaps anywhere;
 *   - consecutive lines are ADJACENT in that character stream — line k's end
 *     index is line k+1's start index, at all 11 junctions.
 *
 * So the last character of one line ends at the exact instant the first
 * character of the next begins, by construction. Every junction has a
 * zero-width gap, and the "exact" boundary comes out identical to the
 * reported one, to the millisecond, at every junction. There is nothing to
 * measure and no recording in which there would be.
 *
 * Worse, cutting there is a step BACKWARDS: the reported instant at least had
 * guards around it, and the measured path moves it into real silence. A span
 * boundary has neither. Silence in the master remains the only thing that
 * says where a voice actually stops.
 *
 * (The per-character durations WITHIN a line are real — a trailing "." can
 * hold a full second of pause. But that pause is absorbed inconsistently: on
 * the same response, five of twelve lines end on a final character of 0.001s,
 * which no real speech does. Not a foundation to build on.)
 */

const round = (n) => Number(n.toFixed(3));

/** A canonical 44-byte WAV header for a PCM payload of this many bytes. */
export function wavHeader(dataBytes) {
  const h = Buffer.alloc(44);
  const byteRate = bytesPerSecond();
  const blockAlign = PCM.channels * PCM.bytesPerSample;
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); // PCM fmt chunk size
  h.writeUInt16LE(1, 20); // format 1 = PCM
  h.writeUInt16LE(PCM.channels, 22);
  h.writeUInt32LE(PCM.sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(PCM.bytesPerSample * 8, 34);
  h.write("data", 36);
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

/**
 * The request body for a whole block, with no pause splitting it.
 *
 * The run itself asks by render unit (see renderPlan), because a pause mark
 * can end a request part way through a block. This is the same thing for the
 * ordinary case, and is what the block packing is checked against.
 */
export function blockInputs(episode, block) {
  const lines = blockLines(episode, block);
  if (!lines.length) throw new Error(`${block.id} has no lines`);
  return unitInputs({ lines });
}

/**
 * Line starts and ends, per line, from the merged segments.
 *
 * ElevenLabs returns one segment per input, and the inputs were the lines in
 * order, so the two line up — but only if the counts agree. They can disagree
 * when a line is dropped or merged upstream, and a silent mismatch would
 * assign every later line the wrong start. So it is checked, not assumed.
 */
export function timingFromSegments(episode, segments) {
  const lineCount = episode.segments.reduce((n, s) => n + s.lines.length, 0);
  if (segments.length !== lineCount) {
    throw new Error(
      `ElevenLabs returned ${segments.length} segments for ${lineCount} lines — ` +
        "the timing cannot be trusted. Regenerate the affected block.",
    );
  }
  return {
    lineStarts: segments.map((s) => round(Number(s.start_time_seconds))),
    lineEnds: segments.map((s) => round(Number(s.end_time_seconds))),
  };
}

// ── generating ────────────────────────────────────────────────────────────

/**
 * What to say when the account is not allowed the format that was asked for.
 *
 * This is not a bug and not a key problem, and it reads like both. 44.1kHz
 * PCM is Pro-tier only; every other rate works on any account and costs this
 * pipeline nothing, so the answer is one line in .env.local rather than an
 * upgrade.
 */
export function tierRefusal(body) {
  if (!/output_format_not_allowed|subscription_required/.test(body)) return null;
  return [
    `Your ElevenLabs plan does not include pcm_${PCM.sampleRate}.`,
    "",
    "Only the 44.1kHz PCM formats need the Pro tier. Any lower rate is allowed",
    "on every plan and this pipeline works exactly the same at one — the joins",
    "stay sample-exact — so record at 24kHz instead. Add this line to .env.local",
    "and restart:",
    "",
    "    LT_TV_PCM_RATE=24000",
    "",
    "From a terminal you can also pass it for one run:",
    "",
    `    LT_TV_PCM_RATE=24000 npm run lt:audio -- <the record>`,
    "",
    `What ElevenLabs said: ${body.slice(0, 200)}`,
  ].join("\n");
}

/**
 * What a block is made of, as one short string.
 *
 * A BLOCK ID IS A POSITION, NOT AN IDENTITY. `packBlocks` numbers blocks
 * `block-1`, `block-2`, … by where they fall, and re-packs them whenever a
 * segment's length changes — so after an edit, `block-2` covers different
 * lines than the `block-2` on disk. Keeping blocks by id alone therefore
 * reuses audio of the OLD words under the NEW block's name, and everything
 * after it is laid out from the old block's duration and the old block's
 * segment list.
 *
 * That is not a subtle failure. Michelle recorded roundtable-02 on
 * 2026-09-21, after applying edits, and got the line she had rewritten read
 * exactly as before, plus lines that started in one character's voice and
 * finished in the other's — the stems being cut to segment spans that no
 * longer described the audio.
 *
 * So a kept block is reusable only when it was recorded from these words, in
 * this order, in these voices.
 */
export function blockFingerprint(inputs) {
  return createHash("sha256")
    .update(JSON.stringify(inputs.map(({ text, voice_id }) => [voice_id, text])))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Whether a kept block can be used again, and if not, why not in one phrase.
 *
 * Both reasons are about the audio no longer describing what the record now
 * claims, and both are silent if not checked: one plays the wrong words, the
 * other places every later line wrongly.
 */
export function cacheIsUsable(kept, { format, fingerprint }) {
  if ((kept.lt_tv_output_format ?? "pcm_44100") !== format) {
    return {
      ok: false,
      why: `the kept copy is ${kept.lt_tv_output_format ?? "pcm_44100"} and this run is ${format}`,
    };
  }
  // A block kept before blocks were fingerprinted cannot be shown to match, and
  // the cost of assuming wrongly is an episode that says the wrong thing.
  if (!kept.lt_tv_inputs) {
    return { ok: false, why: "the kept copy predates this check, so it cannot be shown to match" };
  }
  if (kept.lt_tv_inputs !== fingerprint) {
    return { ok: false, why: "the kept copy was recorded from different words" };
  }
  return { ok: true };
}

/**
 * What a kept block is worth to this run, WITHOUT spending anything.
 *
 * "Record it again" asks for confirmation with the words "this spends an
 * ElevenLabs render", because the button cannot know. Usually most of the
 * episode is reused and the confirmation overstates it; sometimes nothing is
 * reusable and it understates the size. Either way, guessing is not good
 * enough — Michelle has paid twice for an answer that was on disk.
 *
 */
export function cacheReport(kept, { format, fingerprint }) {
  if (kept === null) {
    return { reuse: false, why: "it has not been recorded yet" };
  }
  const usable = cacheIsUsable(kept, { format, fingerprint });
  return { reuse: usable.ok, why: usable.ok ? null : usable.why };
}

/**
 * The whole episode's answer, as lines to print and a count of what it costs.
 */
export function costReport(rows) {
  const reused = rows.filter((r) => r.reuse);
  const fresh = rows.filter((r) => !r.reuse);
  const lines = rows.map((r) =>
    r.reuse
      ? `  ${r.id}: already recorded, reused free`
      : `  ${r.id}: recorded again, because ${r.why}`,
  );
  return { lines, reused: reused.length, fresh: fresh.length };
}

/**
 * THE CLIP FILES ARE NOT WRITTEN BY THIS STEP, AND AFTER IT THEY ARE WRONG.
 *
 * Recording writes the master, the timings and the block cache. The per
 * character `lttv_*.wav` files that actually get uploaded are cut by the SPLIT
 * step, from that master. So after a re-record the clips sitting in the folder
 * are the previous cut of a master that no longer exists — same names, same
 * place, stale contents.
 *
 * Michelle hit this on 2026-09-21: she re-recorded, played
 * `lttv_rt_ep02_connor.wav`, heard the fault she had just had fixed, and
 * reasonably concluded the fix had failed. The file had not been touched.
 *
 * They are named rather than deleted. Deleting what someone may be mid-upload
 * with is not this step's call, and the split overwrites them anyway.
 */
export function staleClipsAfterRecord(existing) {
  return existing.filter((name) => /^lttv_[a-z0-9_]+\.wav$/.test(name)).sort();
}

export function staleClipWarning(stale) {
  if (!stale.length) return null;
  const list = stale.length > 4 ? `${stale.slice(0, 4).join(", ")} and ${stale.length - 4} more`
    : stale.join(", ");
  return (
    `The ${stale.length} clip file(s) in this folder are from the PREVIOUS split and are\n` +
    `now out of date: ${list}.\n\n` +
    "Recording writes the master; the split is what cuts the clips. Playing one of\n" +
    "them before splitting plays the old episode. Split before you listen, and\n" +
    "before you upload anything to SitePal."
  );
}

async function generateBlock({ inputs, key, outDir, id }) {
  // Blocks cost money and a long episode is several of them, so a finished
  // block is kept. A run that dies on block four resumes at block four.
  //
  // A kept block is only reusable at the rate it was recorded at: its length
  // in bytes is how every later line is placed, so mixing rates inside one
  // episode would desync it from the join onwards. Blocks kept before the
  // rate was settable are all 44100. And it must be the same WORDS — see
  // blockFingerprint, which is the harder of the two to notice going wrong.
  const format = `pcm_${PCM.sampleRate}`;
  const fingerprint = blockFingerprint(inputs);
  const cached = join(outDir, `${id}.json`);
  if (existsSync(cached)) {
    const kept = JSON.parse(await readFile(cached, "utf8"));
    const usable = cacheIsUsable(kept, { format, fingerprint });
    if (usable.ok) {
      console.log(`  ${id}: using the copy already in ${basename(outDir)}/`);
      return kept;
    }
    console.log(`  ${id}: ${usable.why}, so it is being recorded again.`);
  }

  const res = await fetch(`${ENDPOINT}?output_format=${format}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(tierRefusal(body) || `${id}: ElevenLabs ${res.status} — ${body.slice(0, 300)}`);
  }
  const payload = await res.json();
  if (!payload?.audio_base64) {
    throw new Error(`${id}: no audio came back — ${JSON.stringify(payload).slice(0, 300)}`);
  }
  await writeFile(
    cached,
    JSON.stringify({ ...payload, lt_tv_output_format: format, lt_tv_inputs: fingerprint }),
  );
  return payload;
}

async function main() {
  const recordPath = process.argv[2];
  if (!recordPath) {
    console.error("Usage: node scripts/lt-tv-audio.mjs <episode record.json>");
    process.exit(2);
  }
  // A dry run reads files and spends nothing, so it must not need a key.
  const dryRun = process.argv.includes("--dry-run");
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key && !dryRun) {
    console.error("ELEVENLABS_API_KEY is not set.");
    process.exit(2);
  }

  const loaded = JSON.parse(await readFile(resolve(recordPath), "utf8"));
  const { episode, changes: revoiced } = revoice(loaded);
  if (episode.synthetic) {
    console.error(
      "This record is marked synthetic — its numbers are invented and it must not be recorded.",
    );
    process.exit(2);
  }

  // THE WORDS ABOUT TO BE RENDERED ARE THE RECORD'S, NOT THE SCREENPLAY'S.
  // Saving the screenplay does not change the record; applying it does. Those
  // are two buttons in the studio and it is not obvious that recording reads
  // the second one's output, so this used to render the old words, pay for
  // them, and say nothing. Michelle lost a full episode to it on 2026-09-20.
  const scriptPath = resolve(recordPath).replace(/\.json$/, ".txt");
  const scriptText = existsSync(scriptPath) ? await readFile(scriptPath, "utf8") : null;
  if (scriptText !== null) {
    const pending = pendingEdits(episode, scriptText, {
      scriptName: basename(scriptPath),
      recordName: basename(recordPath),
    });
    if (pending) {
      console.error(
        `${basename(scriptPath)} has edits that are not in the record yet, so recording\n` +
          `now would render the old words: ${summariseEdits(pending.changes)}.\n\n` +
          'Apply them first — the studio button is "Apply my edits", or:\n' +
          `  npm run lt:edit -- ${episode.id}\n\n` +
          "Nothing has been spent.",
      );
      process.exit(2);
    }
  }

  // Planned BEFORE a single block is generated, so a pause that cannot be
  // placed, or one written as a number that is not a pause, is heard about
  // while nothing has been spent.
  const pauses = scriptText === null ? new Map() : readPauseMarks(scriptText);
  const units = renderPlan(episode, pauses);
  const stranded = strandedPauses(episode, pauses);

  const outDir = resolve("content/lt-tv/audio", episode.id);
  if (!dryRun) await mkdir(outDir, { recursive: true });

  if (dryRun) {
    const format = `pcm_${PCM.sampleRate}`;
    const rows = [];
    for (const unit of units) {
      const cached = join(outDir, `${unit.id}.json`);
      const kept = existsSync(cached) ? JSON.parse(await readFile(cached, "utf8")) : null;
      rows.push({
        id: unit.id,
        ...cacheReport(kept, { format, fingerprint: blockFingerprint(unitInputs(unit)) }),
      });
    }
    const { lines, reused, fresh } = costReport(rows);
    console.log(`${episode.title} — what recording again would do:\n`);
    for (const line of lines) console.log(line);
    console.log(
      `\n${fresh} of ${rows.length} would be sent to ElevenLabs. ` +
        `${reused} cost nothing.`,
    );
    if (fresh === 0) {
      console.log(
        "\nSo this is free. The studio still asks before it runs, because the button\n" +
          "cannot know that until this has been checked.",
      );
    }
    console.log("\nNothing has been spent.");
    return;
  }

  for (const change of revoiced) {
    console.log(
      `${change.name} has a different voice now, so the record's ${change.was} is being\n` +
        `recorded as ${change.now}. Anything already recorded in the old voice is redone.`,
    );
  }

  const split = units.length - episode.blocks.length;
  console.log(
    `${episode.title} — ${units.length} recording(s), pcm_${PCM.sampleRate}` +
      `${PCM.sampleRate === 44100 ? "" : " (set by LT_TV_PCM_RATE)"}` +
      (split > 0 ? `, ${split} of them split out by a pause you asked for` : ""),
  );
  for (const unit of units.slice(1)) {
    console.log(
      `  ${unit.pauseBefore}s before line ${unit.firstLine}` +
        (unit.asked ? " — from the script" : " — the beat between acts, LT_TV_ACT_BEAT"),
    );
  }
  const warning = strandedWarning(stranded, episode);
  if (warning) console.log(`\n${warning}\n`);

  const built = [];
  for (const unit of units) {
    const payload = await generateBlock({
      inputs: unitInputs(unit),
      key,
      outDir,
      id: unit.id,
    });
    const audio = Buffer.from(payload.audio_base64, "base64");
    const segments = payload.voice_segments || [];

    const sanity = pcmLooksRight(audio.length, segments);
    if (!sanity.ok) {
      throw new Error(
        `${unit.id}: decoded ${sanity.seconds.toFixed(1)}s of audio but the last word ends at ` +
          `${sanity.lastEnd.toFixed(1)}s. The PCM format assumption ` +
          `(${PCM.sampleRate}Hz, ${PCM.channels}ch, ${PCM.bytesPerSample * 8}-bit) is probably wrong.`,
      );
    }
    console.log(`  ${unit.id}: ${sanity.seconds.toFixed(1)}s, ${segments.length} line(s)`);
    built.push({ id: unit.id, audio, byteLength: audio.length, segments });
  }

  const gaps = units.slice(1).map((unit) => unit.bytes);
  const merged = mergeBlocks(built, { gaps });
  const timing = timingFromSegments(episode, merged.segments);

  // The same bytes the timings were computed from, in the same places.
  const pcm = Buffer.concat(
    built.flatMap((b, i) => (i ? [Buffer.alloc(gaps[i - 1]), b.audio] : [b.audio])),
  );
  const masterPath = join(outDir, "master-dialogue.wav");
  await writeFile(masterPath, Buffer.concat([wavHeader(pcm.length), pcm]));
  await writeFile(
    join(outDir, "voice-segments.json"),
    JSON.stringify(merged.segments, null, 2) + "\n",
  );

  // A line-spans.json from the hour this was believed in would now be used in
  // preference to the measured boundaries, so it goes. See the note above.
  const spansPath = join(outDir, "line-spans.json");
  if (existsSync(spansPath)) {
    await rm(spansPath);
    console.log("\nRemoved line-spans.json: those timings were not measurements.");
  }

  // The production record learns its own timing, so the slate record the join
  // writes next is playable rather than a slate entry.
  episode.timing = {
    ...episode.timing,
    lineStarts: timing.lineStarts,
    lineEnds: timing.lineEnds,
    durationSeconds: merged.durationSeconds,
  };
  // A block that was split still reports as ONE block, spanning its parts and
  // the pause between them, because that is what the record has always meant
  // by a block and nothing downstream needs to know how it was requested.
  const blockOf = new Map(units.map((u) => [u.id, u.block]));
  episode.blocks = episode.blocks.map((b) => {
    const mine = merged.blocks.filter((p) => blockOf.get(p.id) === b.id);
    const last = mine[mine.length - 1];
    return {
      ...b,
      offsetSeconds: mine[0].offsetSeconds,
      durationSeconds: round(last.offsetSeconds + last.durationSeconds - mine[0].offsetSeconds),
    };
  });
  await writeFile(resolve(recordPath), JSON.stringify(episode, null, 2) + "\n");

  const mins = Math.floor(merged.durationSeconds / 60);
  console.log(
    `\n${masterPath}\n` +
      `${mins}:${String(Math.round(merged.durationSeconds % 60)).padStart(2, "0")} ` +
      `across ${built.length} block(s), ${merged.segments.length} lines timed.`,
  );
  console.log(`Updated ${recordPath} with the real timing.`);
  // Naming the clips here rather than pointing at the record: "the names the
  // record prescribes in `cast`" is a true sentence that leaves you opening a
  // JSON file to find two strings, and a wrong one plays nothing.
  const stale = staleClipWarning(staleClipsAfterRecord(await readdir(outDir)));
  if (stale) console.log(`\n${stale}`);

  const plan = uploadPlan(episode, episode.id);
  console.log(
    `\nNext, split it into the two tracks SitePal plays (this part needs ffmpeg):\n` +
      `  npm run lt:split -- ${episode.id}\n`,
  );
  if (plan.length) {
    console.log("That writes the two WAVs you upload, which will be:\n");
    for (const row of plan) {
      console.log(`  ${row.who}`);
      console.log(`    file  ${row.file}`);
      console.log(`    name  ${row.clip}\n`);
    }
  }
  // The split step is what hands over the last command, because it is the one
  // that knows the section boundaries. Naming the generator here, which this
  // used to do, points at the run that rebuilds the episode and discards the
  // timing written a few lines above.
  console.log("Then that step tells you how to put it on the guide.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
