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

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps";

// ── the PCM assumption, made self-checking ────────────────────────────────
//
// `pcm_44100` is documented as 16-bit signed little-endian mono. Every
// duration below is computed from that, so if it is ever wrong every offset
// is wrong by the same ratio and the episode desyncs silently. It is not
// something this environment can verify, so instead of trusting it the run
// cross-checks each block's byte length against the last timestamp ElevenLabs
// itself reported for that block. A wrong assumption fails loudly on block
// one rather than quietly at minute four.
export const PCM = { sampleRate: 44100, channels: 1, bytesPerSample: 2 };
const BYTES_PER_SECOND = PCM.sampleRate * PCM.channels * PCM.bytesPerSample;

/** Seconds of audio in a raw PCM buffer of this format. */
export function pcmSeconds(byteLength) {
  return byteLength / BYTES_PER_SECOND;
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
 * @returns { segments, durationSeconds, blocks: [{ id, offsetSeconds, durationSeconds }] }
 */
export function mergeBlocks(blocks) {
  const segments = [];
  const placed = [];
  let offset = 0;

  for (const block of blocks) {
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
  const byteRate = BYTES_PER_SECOND;
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

async function generateBlock({ inputs, key, outDir, id }) {
  // Blocks cost money and a long episode is several of them, so a finished
  // block is kept. A run that dies on block four resumes at block four.
  const cached = join(outDir, `${id}.json`);
  if (existsSync(cached)) {
    console.log(`  ${id}: using the copy already in ${basename(outDir)}/`);
    return JSON.parse(await readFile(cached, "utf8"));
  }

  const res = await fetch(`${ENDPOINT}?output_format=pcm_${PCM.sampleRate}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) {
    throw new Error(`${id}: ElevenLabs ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }
  const payload = await res.json();
  if (!payload?.audio_base64) {
    throw new Error(`${id}: no audio came back — ${JSON.stringify(payload).slice(0, 300)}`);
  }
  await writeFile(cached, JSON.stringify(payload));
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

  const outDir = resolve("content/lt-tv/audio", episode.id);
  await mkdir(outDir, { recursive: true });

  console.log(`${episode.title} — ${episode.blocks.length} block(s)`);
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

  const merged = mergeBlocks(built);
  const timing = timingFromSegments(episode, merged.segments);

  const pcm = Buffer.concat(built.map((b) => b.audio));
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
  console.log(
    "\nNext, split it into the two balanced tracks (this part needs ffmpeg):\n" +
      `  python3 elevenlabs-dialogue-test/process_dialogue.py --master ${masterPath} \\\n` +
      `      --segments ${join(outDir, "voice-segments.json")} ${outDir}\n` +
      "Then upload both WAVs under the names the record prescribes in `cast`, and\n" +
      "re-run scripts/lt-news-script.mjs to refresh the slate record.",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
