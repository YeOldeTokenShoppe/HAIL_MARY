#!/usr/bin/env node
// STEP 3 — BUILD THE AUDIO FOR AN EPISODE.
//
//   node scripts/lt-tv-audio.mjs content/lt-tv/episodes/news-2026-W38.json
//   node scripts/lt-tv-audio.mjs content/lt-tv/episodes/roundtable-02.json --dry-run
//
// EVERY LINE IS RENDERED ON ITS OWN, IN ITS OWN VOICE. That is the whole
// design, and it replaces one that rendered the conversation as blocks with
// both voices in one file and then tried to cut that file apart by character.
//
// WHY. The two SitePal avatars each lip-sync whatever is in their own clip, so
// a track has to hold one voice and nothing else. Cutting a two-voice render
// apart needs to know, to a tenth of a second, where one voice stops and the
// other starts — and the only thing ElevenLabs reports about that is a set of
// line times which are a division of the text, not a measurement of the
// audio. On roundtable-02 they were a phrase out, in five different attempts
// to work around them, and every attempt put a fragment of Saint GR80 in
// Connor's mouth. There is no boundary to find when there is no boundary:
// a line rendered alone can only ever be in one track.
//
// WHAT IT GIVES BACK. A line's audio is a known number of bytes, so the two
// tracks are laid out by arithmetic — no ffmpeg, no silence detection, no
// guessing. A pause can go in front of ANY line, exactly, because every gap
// is ours. Section cuts land in silence we put there. Re-recording one edited
// line costs one line. The master still exists (both tracks summed) for
// listening to the whole thing at once.
//
// WHAT IT COSTS. The model no longer hears the other character's line while
// performing a reply, so the delivery leans more on the [tags] in the script.
// The neighbouring lines' text is passed as context (`previous_text` and
// `next_text`), which the API accepts; whether v3 makes much of it is not
// something this file can promise. Michelle chose this trade on 2026-09-21
// after hearing the alternative fail five times.
//
// WHY PCM AND NOT MP3. Raw PCM concatenates by appending bytes and a buffer's
// duration is its byte count, so the audio and the timings come from ONE set
// of integers and cannot disagree. An mp3 frame carries encoder padding that
// the timestamps know nothing about.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { createHash } from "node:crypto";

import { uploadPlan } from "./lt-tv-split.mjs";
import { CAST } from "./lt-tv-format.mjs";
import { pendingEdits, summariseEdits, readPauseMarks } from "./lt-tv-edit.mjs";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
export const MODEL_ID = "eleven_v3";

// ── the PCM format ────────────────────────────────────────────────────────
//
// ElevenLabs PCM is 16-bit signed little-endian mono at whatever rate was
// asked for. THE RATE IS AN ACCOUNT FACT, NOT AN EPISODE ONE: 44.1kHz PCM is
// a Pro-tier format, and an account below that tier is refused it outright.
// Any other rate is allowed and the design does not care which. Speech at
// 24kHz carries 12kHz of bandwidth, more than a voice uses, and SitePal
// re-encodes the upload anyway.
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

/** Bytes of PCM per second at the configured rate. Read, never cached — the rate moves. */
const bytesPerSecond = () => PCM.sampleRate * PCM.channels * PCM.bytesPerSample;
const frameBytes = () => PCM.channels * PCM.bytesPerSample;

/** Seconds of audio in a raw PCM buffer of this format. */
export function pcmSeconds(byteLength) {
  return byteLength / bytesPerSecond();
}

/**
 * Seconds as a whole number of samples, in bytes.
 *
 * Bytes rather than seconds is the point: the audio and the timings are then
 * derived from ONE integer and cannot disagree. A part-sample gap would put
 * every later line a fraction out, which is the failure this file is built
 * to avoid.
 */
export function beatBytes(seconds = ACT_BEAT_SECONDS) {
  const frame = frameBytes();
  return Math.round((seconds * bytesPerSecond()) / frame) * frame;
}

// ── the gaps between lines ────────────────────────────────────────────────
//
// In a two-voice render the pauses came from the model. Here every pause is
// placed by this file, so there are three kinds, all exact:
//
//   LT_TV_LINE_GAP   between two lines in the same act (default 0.45s)
//   LT_TV_ACT_BEAT   between two acts, the biggest pause in the show (0.7s)
//   # pause 1.5s     written in the screenplay above a line, any line
//
// The line gap is the one to tune by ear: shorter reads as interruption,
// longer as a beat. It is a number in .env.local, not a re-render.
export const ACT_BEAT_SECONDS = secondsFromEnv("LT_TV_ACT_BEAT", 0.7);
export const LINE_GAP_SECONDS = secondsFromEnv("LT_TV_LINE_GAP", 0.45);

/**
 * Silence after the last line, so the closing word is not the last sample.
 * SitePal stops a clip where the file stops, and a word that ends on the
 * final sample is heard as clipped even when it is whole.
 */
export const TAIL_SECONDS = 0.6;

/** A configured number of seconds, refusing a value that would read as a fault. */
function secondsFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3) {
    throw new Error(`${name}=${raw} is not a number of seconds between 0 and 3.`);
  }
  return seconds;
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
 *
 * A voice is a property of the show, so the show wins, and the record is
 * corrected to say what was actually rendered. The line fingerprint covers
 * the voice id, so anything cached under the old voice is re-recorded rather
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

/** Every line in the episode, in running order, each knowing its segment. */
export function episodeLines(episode) {
  return episode.segments.flatMap((segment, k) =>
    segment.lines.map((line) => ({ ...line, segmentId: segment.id, segmentIndex: k })),
  );
}

/** Every line number in the episode, in order. */
const lineNumbers = (episode) => episode.segments.flatMap((s) => s.lines.map((l) => l.n));

/**
 * What to render and how much silence to put in front of each line.
 *
 * One unit per line. The gap before a line is, in order of precedence: what
 * the screenplay asked for with `# pause`, the act beat when the line opens a
 * new segment, otherwise the line gap. Nothing goes in front of the first
 * line: the lead-in on the set already handles the time before the episode.
 *
 * Every gap is a whole number of samples, and the SAME integer places the
 * line on the timeline and pads the tracks — see beatBytes.
 */
export function linePlan(
  episode,
  pauses = new Map(),
  { beat = ACT_BEAT_SECONDS, gap = LINE_GAP_SECONDS } = {},
) {
  const lines = episodeLines(episode);
  if (!lines.length) throw new Error(`${episode.id} has no lines`);

  return lines.map((line, i) => {
    const asked = pauses.get(line.n);
    if (asked !== undefined && !(asked >= 0 && asked <= PAUSE_MARK_MAX_SECONDS)) {
      throw new Error(
        `"# pause ${asked}s" in front of line ${line.n} is not a pause between 0 and ` +
          `${PAUSE_MARK_MAX_SECONDS} seconds.`,
      );
    }
    const opensAct = i > 0 && line.segmentIndex !== lines[i - 1].segmentIndex;
    const fromScript = i > 0 && asked !== undefined;
    const seconds = i === 0 ? 0 : fromScript ? asked : opensAct ? beat : gap;
    return {
      n: line.n,
      actor: line.actor,
      voiceId: line.voiceId,
      text: line.text,
      segmentId: line.segmentId,
      opensAct,
      pauseBefore: seconds,
      bytes: beatBytes(seconds),
      asked: fromScript,
      // The neighbouring lines, as text, for the model to perform against.
      previousText: i > 0 ? lines[i - 1].text : null,
      nextText: i + 1 < lines.length ? lines[i + 1].text : null,
    };
  });
}

/**
 * Pause marks with nowhere to go, so the run can say so rather than drop them.
 *
 * Silently ignoring one would be the same shape of fault as edits that were
 * saved but never applied: the page says one thing, the recording another,
 * and nothing tells you until you play it.
 */
export function strandedPauses(episode, pauses = new Map()) {
  const ns = lineNumbers(episode);
  const known = new Set(ns);
  const first = ns[0];
  return [...pauses.keys()].filter((n) => !known.has(n) || n === first).sort((a, b) => a - b);
}

/** What to say about them, in terms of the page rather than of the plan. */
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

// ── the audio of one line ─────────────────────────────────────────────────

/**
 * What a line's recording is made of, as one short string.
 *
 * A LINE NUMBER IS A POSITION, NOT AN IDENTITY: lines renumber when one is
 * added or removed above them. So a kept recording is filed under a
 * fingerprint of what was actually sent — the voice, the words, the model and
 * the format — and reused only when all four match. Reordering lines costs
 * nothing; rewording one costs that one.
 *
 * The context (`previous_text`) is deliberately NOT part of it: including it
 * would re-render every neighbour of an edited line for a difference nobody
 * has shown they can hear, and the point of caching is that an edit costs
 * what it changed.
 */
export function lineFingerprint({ voiceId, text }, { format = `pcm_${PCM.sampleRate}`, model = MODEL_ID } = {}) {
  return createHash("sha256")
    .update(JSON.stringify([voiceId, text, model, format]))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Loudness at which a sample counts as sound, in 16-bit units.
 *
 * -44 dBFS. ElevenLabs' PCM opens and closes on digital silence or something
 * very near it, and the aim here is only to find the edge of that, not to
 * judge speech. A breath is well above this and is kept.
 */
export const TRIM_THRESHOLD = 200;

/** Silence kept on each side of a trimmed line, so a word never starts on the first sample. */
export const TRIM_KEEP_SECONDS = 0.06;

/**
 * A line's PCM with the silence ElevenLabs padded it with taken off both ends.
 *
 * The model pads each render with some silence, and how much varies from line
 * to line. Left in, that padding would be added to the gap in front of every
 * line by an unknown amount, and the gaps are the thing this design controls.
 * Trimming makes the gap the number it says it is. Nothing inside the line is
 * touched: this only ever removes leading and trailing samples quieter than
 * TRIM_THRESHOLD, and leaves TRIM_KEEP_SECONDS of them.
 *
 * Whole-sample, frame-aligned, and pure — a Buffer in, a Buffer out.
 */
export function trimSilence(pcm, { threshold = TRIM_THRESHOLD, keepSeconds = TRIM_KEEP_SECONDS } = {}) {
  const frame = frameBytes();
  const samples = Math.floor(pcm.length / frame);
  if (samples === 0) return Buffer.alloc(0);
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples; i += 1) {
    if (Math.abs(pcm.readInt16LE(i * frame)) > threshold) {
      first = i;
      break;
    }
  }
  if (first === -1) return Buffer.alloc(0); // nothing but silence
  for (let i = samples - 1; i >= first; i -= 1) {
    if (Math.abs(pcm.readInt16LE(i * frame)) > threshold) {
      last = i;
      break;
    }
  }
  const keep = Math.round(keepSeconds * PCM.sampleRate);
  const from = Math.max(0, first - keep);
  const to = Math.min(samples, last + 1 + keep);
  return pcm.subarray(from * frame, to * frame);
}

/** Seconds of the line's own edge faded in and out, so a trim is never a click. */
export const EDGE_FADE_SECONDS = 0.008;

/**
 * The same PCM with a short linear fade at each end, in place.
 *
 * A trim can leave the first kept sample a little way from zero, and a step
 * from silence to a non-zero sample is a click. Eight milliseconds is below
 * anything heard as a fade and above anything heard as a click.
 */
export function fadeEdges(pcm, seconds = EDGE_FADE_SECONDS) {
  const frame = frameBytes();
  const samples = Math.floor(pcm.length / frame);
  const n = Math.min(Math.round(seconds * PCM.sampleRate), Math.floor(samples / 2));
  for (let i = 0; i < n; i += 1) {
    const gain = i / n;
    const head = i * frame;
    const tail = (samples - 1 - i) * frame;
    pcm.writeInt16LE(Math.round(pcm.readInt16LE(head) * gain), head);
    pcm.writeInt16LE(Math.round(pcm.readInt16LE(tail) * gain), tail);
  }
  return pcm;
}

// ── the arithmetic this whole step rests on ───────────────────────────────

/**
 * Where every line lands on the episode's one timeline.
 *
 * A line begins after the line before it and the gap in front of it, and
 * runs for exactly as many bytes as its audio holds. The episode ends after
 * the last line plus the tail. Pure, so the sums can be checked without a
 * single second of audio.
 *
 * @param units       from linePlan, in order
 * @param byteLengths the (trimmed) audio length of each, in bytes
 * @returns { lines: [{ n, actor, voiceId, offsetBytes, byteLength, start, end,
 *          pauseBefore }], totalBytes, durationSeconds }
 */
export function layoutLines(units, byteLengths, { tailSeconds = TAIL_SECONDS } = {}) {
  if (units.length !== byteLengths.length) {
    throw new Error(`${units.length} lines planned but ${byteLengths.length} recordings — not the same episode.`);
  }
  const frame = frameBytes();
  const lines = [];
  let offset = 0;
  for (const [i, unit] of units.entries()) {
    const byteLength = byteLengths[i];
    if (byteLength % frame !== 0) {
      throw new Error(`Line ${unit.n}'s audio is ${byteLength} bytes, which is not whole samples.`);
    }
    offset += unit.bytes;
    lines.push({
      n: unit.n,
      actor: unit.actor,
      voiceId: unit.voiceId,
      offsetBytes: offset,
      byteLength,
      start: round(pcmSeconds(offset)),
      end: round(pcmSeconds(offset + byteLength)),
      pauseBefore: unit.pauseBefore,
    });
    offset += byteLength;
  }
  const totalBytes = offset + beatBytes(tailSeconds);
  return { lines, totalBytes, durationSeconds: round(pcmSeconds(totalBytes)) };
}

/**
 * The tracks themselves: one full-length buffer per actor, and the master.
 *
 * Each actor's track is silence the length of the episode with that actor's
 * lines copied in at their offsets. The master is every line copied into one
 * buffer. Because no two lines share a byte, the master is exactly the sum of
 * the tracks and the tracks never overlap — which is the property the whole
 * set depends on, and it is true by construction rather than by measurement.
 *
 * @param layout from layoutLines
 * @param audio  Map of line n → trimmed PCM Buffer
 * @param actors the actors to write a track for
 */
export function assembleTracks(layout, audio, actors) {
  const tracks = new Map(actors.map((actor) => [actor, Buffer.alloc(layout.totalBytes)]));
  const master = Buffer.alloc(layout.totalBytes);
  for (const line of layout.lines) {
    const pcm = audio.get(line.n);
    if (!pcm || pcm.length !== line.byteLength) {
      throw new Error(`Line ${line.n}'s audio does not match its place in the layout.`);
    }
    const track = tracks.get(line.actor);
    if (!track) throw new Error(`Line ${line.n} is spoken by ${line.actor}, who has no track.`);
    pcm.copy(track, line.offsetBytes);
    pcm.copy(master, line.offsetBytes);
  }
  return { tracks, master };
}

/**
 * The silences between lines, in the shape the section cutter reads.
 *
 * With a two-voice render these had to be measured from the master with
 * ffmpeg. Here they are known: the gap in front of every line is one this
 * file placed. So the cutter is handed the same list it would have measured,
 * without measuring.
 */
export function lineSilences(layout) {
  const windows = [];
  for (let i = 1; i < layout.lines.length; i += 1) {
    const start = layout.lines[i - 1].end;
    const end = layout.lines[i].start;
    if (end > start) windows.push({ start, end, width: round(end - start) });
  }
  return windows;
}

/** The per-line timing the record and the runtime read. */
export function timingFromLayout(layout) {
  return {
    lineStarts: layout.lines.map((l) => l.start),
    lineEnds: layout.lines.map((l) => l.end),
    durationSeconds: layout.durationSeconds,
  };
}

const round = (n) => Number(n.toFixed(3));

/** A canonical 44-byte WAV header for a PCM payload of this many bytes. */
export function wavHeader(dataBytes) {
  const h = Buffer.alloc(44);
  const byteRate = bytesPerSecond();
  const blockAlign = frameBytes();
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
    "on every plan and this pipeline works exactly the same at one — the layout",
    "stays sample-exact — so record at 24kHz instead. Add this line to .env.local",
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

/** Where a line's kept recording lives: content-addressed, so renumbering is free. */
export function linePaths(outDir, fingerprint) {
  const dir = join(outDir, "lines");
  return { dir, pcm: join(dir, `${fingerprint}.pcm`), meta: join(dir, `${fingerprint}.json`) };
}

/**
 * What a kept line is worth to this run, WITHOUT spending anything.
 *
 * "Record it again" asks for confirmation with the words "this spends an
 * ElevenLabs render", because the button cannot know. Michelle has paid
 * twice for an answer that was on disk, so the answer is computed from the
 * files rather than asserted.
 */
export function lineCostReport(units, kept) {
  const rows = units.map((unit) => {
    const have = kept(unit);
    return {
      n: unit.n,
      actor: unit.actor,
      chars: unit.text.length,
      reuse: have,
      why: have ? null : "it has not been recorded with these words in this voice",
    };
  });
  const reused = rows.filter((r) => r.reuse);
  const fresh = rows.filter((r) => !r.reuse);
  const lines = rows.map((r) =>
    r.reuse
      ? `  line ${String(r.n).padStart(2)}  ${r.actor.padEnd(6)}  already recorded, reused free`
      : `  line ${String(r.n).padStart(2)}  ${r.actor.padEnd(6)}  sent to ElevenLabs (${r.chars} characters), because ${r.why}`,
  );
  return {
    lines,
    reused: reused.length,
    fresh: fresh.length,
    chars: fresh.reduce((n, r) => n + r.chars, 0),
  };
}

/** The request body for one line: its words, and the neighbours as context. */
export function lineRequest(unit, { context = true } = {}) {
  const body = { text: unit.text, model_id: MODEL_ID };
  if (context) {
    if (unit.previousText) body.previous_text = unit.previousText;
    if (unit.nextText) body.next_text = unit.nextText;
  }
  return body;
}

async function generateLine({ unit, key, outDir, context }) {
  // Lines cost money, so a finished line is kept, filed under what was sent.
  // A run that dies on line thirty resumes at line thirty; a re-record after
  // an edit sends the lines that changed and nothing else.
  const format = `pcm_${PCM.sampleRate}`;
  const fingerprint = lineFingerprint(unit, { format });
  const paths = linePaths(outDir, fingerprint);
  if (existsSync(paths.pcm)) {
    return { pcm: await readFile(paths.pcm), reused: true, fingerprint };
  }

  const res = await fetch(`${ENDPOINT}/${unit.voiceId}?output_format=${format}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/*" },
    body: JSON.stringify(lineRequest(unit, { context })),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      tierRefusal(body) || `line ${unit.n}: ElevenLabs ${res.status} — ${body.slice(0, 300)}`,
    );
  }
  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.length < frameBytes() * PCM.sampleRate * 0.1) {
    throw new Error(`line ${unit.n}: only ${raw.length} bytes of audio came back — not a line.`);
  }
  // Kept trimmed and faded, so what is on disk is what goes in the track.
  const pcm = fadeEdges(Buffer.from(trimSilence(raw)));
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.pcm, pcm);
  await writeFile(
    paths.meta,
    JSON.stringify(
      {
        n: unit.n,
        actor: unit.actor,
        voice_id: unit.voiceId,
        text: unit.text,
        model_id: MODEL_ID,
        output_format: format,
        context: context ? { previous_text: unit.previousText, next_text: unit.nextText } : null,
        seconds: round(pcmSeconds(pcm.length)),
        trimmed_seconds: round(pcmSeconds(raw.length - pcm.length)),
        recorded_at: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  return { pcm, reused: false, fingerprint };
}

/**
 * THE CLIP FILES ARE NOT WRITTEN BY THIS STEP, AND AFTER IT THEY ARE WRONG.
 *
 * Recording writes the two full-length tracks and the master. The per
 * character, per section `lttv_*.wav` files that actually get uploaded are
 * cut by the SPLIT step, from those tracks. So after a re-record the clips
 * sitting in the folder are the previous cut — same names, same place, stale
 * contents.
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
    "Recording writes the tracks; the split is what cuts the clips. Playing one of\n" +
    "them before splitting plays the old episode. Split before you listen, and\n" +
    "before you upload anything to SitePal."
  );
}

/** The marker the split step reads to know these tracks need no cutting apart. */
export const RENDER_FILE = "render.json";

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
  // Context on by default; LT_TV_LINE_CONTEXT=0 renders every line cold, which
  // is the way to hear whether the context is doing anything at all.
  const context = process.env.LT_TV_LINE_CONTEXT !== "0";

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

  // Planned BEFORE a single line is generated, so a pause that cannot be
  // placed, or one written as a number that is not a pause, is heard about
  // while nothing has been spent.
  const pauses = scriptText === null ? new Map() : readPauseMarks(scriptText);
  const units = linePlan(episode, pauses);
  const stranded = strandedPauses(episode, pauses);

  const outDir = resolve("content/lt-tv/audio", episode.id);
  const format = `pcm_${PCM.sampleRate}`;
  const kept = (unit) => existsSync(linePaths(outDir, lineFingerprint(unit, { format })).pcm);

  if (dryRun) {
    const report = lineCostReport(units, kept);
    console.log(`${episode.title} — what recording again would do:\n`);
    for (const line of report.lines) console.log(line);
    console.log(
      `\n${report.fresh} of ${units.length} lines would be sent to ElevenLabs` +
        `${report.fresh ? `, ${report.chars} characters in all` : ""}. ` +
        `${report.reused} cost nothing.`,
    );
    if (report.fresh === 0) {
      console.log(
        "\nSo this is free. The studio still asks before it runs, because the button\n" +
          "cannot know that until this has been checked.",
      );
    }
    console.log("\nNothing has been spent.");
    return;
  }

  await mkdir(outDir, { recursive: true });

  for (const change of revoiced) {
    console.log(
      `${change.name} has a different voice now, so the record's ${change.was} is being\n` +
        `recorded as ${change.now}. Anything already recorded in the old voice is redone.`,
    );
  }

  const fresh = units.filter((u) => !kept(u)).length;
  console.log(
    `${episode.title} — ${units.length} lines, each rendered on its own, ${format}` +
      `${PCM.sampleRate === 44100 ? "" : " (set by LT_TV_PCM_RATE)"}. ` +
      `${fresh} to record, ${units.length - fresh} already on disk.`,
  );
  console.log(
    `  ${LINE_GAP_SECONDS}s between lines, ${ACT_BEAT_SECONDS}s between acts` +
      `${context ? ", each line performed with its neighbours as context" : ", no context"}.`,
  );
  for (const unit of units.filter((u) => u.asked)) {
    console.log(`  ${unit.pauseBefore}s before line ${unit.n} — from the script`);
  }
  const warning = strandedWarning(stranded, episode);
  if (warning) console.log(`\n${warning}\n`);

  const audio = new Map();
  let sent = 0;
  for (const unit of units) {
    const { pcm, reused } = await generateLine({ unit, key, outDir, context });
    if (!reused) sent += 1;
    audio.set(unit.n, pcm);
    const who = (episode.cast?.[unit.actor]?.displayName ?? unit.actor).padEnd(10);
    console.log(
      `  line ${String(unit.n).padStart(2)}  ${who} ${pcmSeconds(pcm.length).toFixed(1).padStart(5)}s` +
        `${reused ? "  (kept)" : ""}`,
    );
  }

  // ── the timeline, and the same bytes in the same places ──────────────────
  const layout = layoutLines(units, units.map((u) => audio.get(u.n).length));
  const actors = Object.keys(episode.cast ?? {});
  const { tracks, master } = assembleTracks(layout, audio, actors);

  for (const [actor, pcm] of tracks) {
    const keyName = episode.cast[actor].processorKey;
    await writeFile(join(outDir, `${keyName}-sitepal-balanced.wav`), Buffer.concat([wavHeader(pcm.length), pcm]));
  }
  const masterPath = join(outDir, "master-dialogue.wav");
  await writeFile(masterPath, Buffer.concat([wavHeader(master.length), master]));

  // The per-line windows, in the shape the older split path and the stale
  // voice check read, so nothing downstream has to know how this was made.
  await writeFile(
    join(outDir, "voice-segments.json"),
    JSON.stringify(
      layout.lines.map((l) => ({
        voice_id: l.voiceId,
        actor: l.actor,
        line: l.n,
        start_time_seconds: l.start,
        end_time_seconds: l.end,
      })),
      null,
      2,
    ) + "\n",
  );
  // The marker the split reads: these tracks are already one voice each, and
  // every gap between lines is known, so there is nothing to cut apart and
  // nothing to measure.
  await writeFile(
    join(outDir, RENDER_FILE),
    JSON.stringify(
      {
        mode: "lines",
        sampleRate: PCM.sampleRate,
        model: MODEL_ID,
        context,
        lineGapSeconds: LINE_GAP_SECONDS,
        actBeatSeconds: ACT_BEAT_SECONDS,
        durationSeconds: layout.durationSeconds,
        lines: layout.lines.map(({ n, actor, start, end, pauseBefore }) => ({ n, actor, start, end, pauseBefore })),
        silences: lineSilences(layout),
        renderedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  // The production record learns its own timing, so the slate record the join
  // writes next is playable rather than a slate entry.
  const timing = timingFromLayout(layout);
  episode.timing = { ...episode.timing, ...timing };
  // Blocks were how a two-voice render was requested. They are still in the
  // record because the editor packs them, so each is given the span of the
  // lines it covers; nothing is requested by block any more.
  const byLine = new Map(layout.lines.map((l) => [l.n, l]));
  episode.blocks = (episode.blocks ?? []).map((b) => {
    const first = byLine.get(b.firstLine);
    const last = byLine.get(b.lastLine);
    return first && last
      ? { ...b, offsetSeconds: first.start, durationSeconds: round(last.end - first.start) }
      : b;
  });
  await writeFile(resolve(recordPath), JSON.stringify(episode, null, 2) + "\n");

  const mins = Math.floor(layout.durationSeconds / 60);
  console.log(
    `\n${masterPath}\n` +
      `${mins}:${String(Math.round(layout.durationSeconds % 60)).padStart(2, "0")}, ` +
      `${layout.lines.length} lines, ${sent} sent to ElevenLabs, ${units.length - sent} reused.`,
  );
  console.log(`Updated ${recordPath} with the real timing.`);
  const stale = staleClipWarning(staleClipsAfterRecord(await readdir(outDir)));
  if (stale) console.log(`\n${stale}`);

  const plan = uploadPlan(episode, episode.id);
  console.log(
    `\nThe two tracks are written. Next, cut them into the clips SitePal plays:\n` +
      `  npm run lt:split -- ${episode.id}\n`,
  );
  if (plan.length) {
    console.log("That writes the WAVs you upload, which will be:\n");
    for (const row of plan) {
      console.log(`  ${row.who}`);
      console.log(`    file  ${row.file}`);
      console.log(`    name  ${row.clip}\n`);
    }
  }
  console.log("Then that step tells you how to put it on the guide.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
