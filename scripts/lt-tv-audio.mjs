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

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { createHash } from "node:crypto";

import { uploadPlan } from "./lt-tv-split.mjs";
import { pendingEdits, summariseEdits } from "./lt-tv-edit.mjs";

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
 * @returns { segments, durationSeconds, blocks: [{ id, offsetSeconds, durationSeconds }] }
 */
export function mergeBlocks(blocks, { gapBytes = 0 } = {}) {
  const segments = [];
  const placed = [];
  let offset = 0;

  for (const [index, block] of blocks.entries()) {
    if (index > 0) offset += pcmSeconds(gapBytes);
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

/** The request body for one block: the conversation, in order, with voices. */
export function blockInputs(episode, block) {
  const lines = episode.segments
    .filter((s) => block.segments.includes(s.id))
    .flatMap((s) => s.lines);
  if (!lines.length) throw new Error(`${block.id} has no lines`);
  return lines.map((line) => ({ text: line.text, voice_id: line.voiceId }));
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
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.error("ELEVENLABS_API_KEY is not set.");
    process.exit(2);
  }

  const episode = JSON.parse(await readFile(resolve(recordPath), "utf8"));
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
  if (existsSync(scriptPath)) {
    const pending = pendingEdits(episode, await readFile(scriptPath, "utf8"), {
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

  const outDir = resolve("content/lt-tv/audio", episode.id);
  await mkdir(outDir, { recursive: true });

  console.log(
    `${episode.title} — ${episode.blocks.length} block(s), pcm_${PCM.sampleRate}` +
      `${PCM.sampleRate === 44100 ? "" : " (set by LT_TV_PCM_RATE)"}`,
  );
  const built = [];
  for (const block of episode.blocks) {
    const payload = await generateBlock({
      inputs: blockInputs(episode, block),
      key,
      outDir,
      id: block.id,
    });
    const audio = Buffer.from(payload.audio_base64, "base64");
    const segments = payload.voice_segments || [];

    const sanity = pcmLooksRight(audio.length, segments);
    if (!sanity.ok) {
      throw new Error(
        `${block.id}: decoded ${sanity.seconds.toFixed(1)}s of audio but the last word ends at ` +
          `${sanity.lastEnd.toFixed(1)}s. The PCM format assumption ` +
          `(${PCM.sampleRate}Hz, ${PCM.channels}ch, ${PCM.bytesPerSample * 8}-bit) is probably wrong.`,
      );
    }
    console.log(`  ${block.id}: ${sanity.seconds.toFixed(1)}s, ${segments.length} line(s)`);
    built.push({ id: block.id, audio, byteLength: audio.length, segments });
  }

  const gapBytes = built.length > 1 ? beatBytes() : 0;
  if (gapBytes) {
    console.log(
      `  a ${ACT_BEAT_SECONDS}s beat between acts (${built.length - 1} of them) — ` +
        "set LT_TV_ACT_BEAT to change it",
    );
  }
  const merged = mergeBlocks(built, { gapBytes });
  const timing = timingFromSegments(episode, merged.segments);

  // The same bytes the timings were computed from, in the same places.
  const beat = Buffer.alloc(gapBytes);
  const pcm = Buffer.concat(built.flatMap((b, i) => (i ? [beat, b.audio] : [b.audio])));
  const masterPath = join(outDir, "master-dialogue.wav");
  await writeFile(masterPath, Buffer.concat([wavHeader(pcm.length), pcm]));
  await writeFile(
    join(outDir, "voice-segments.json"),
    JSON.stringify(merged.segments, null, 2) + "\n",
  );

  // The production record learns its own timing, so the slate record the join
  // writes next is playable rather than a slate entry.
  episode.timing = {
    ...episode.timing,
    lineStarts: timing.lineStarts,
    lineEnds: timing.lineEnds,
    durationSeconds: merged.durationSeconds,
  };
  episode.blocks = episode.blocks.map((b) => {
    const placed = merged.blocks.find((p) => p.id === b.id);
    return { ...b, offsetSeconds: placed.offsetSeconds, durationSeconds: placed.durationSeconds };
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
