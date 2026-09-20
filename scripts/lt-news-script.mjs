#!/usr/bin/env node
//
// lt-news-script — step 2 of the LT Weekly News Recap pipeline.
//
// Takes a brief from scripts/lt-news-brief.mjs and produces an EPISODE RECORD:
// one JSON file that holds everything about one episode — its slate metadata,
// its chiron copy, every spoken line with its voice, its recording blocks, its
// animation cues, and the sources it is built on.
//
// That record is the thing the repo is missing. Today an episode is metadata in
// LTTvBroadcastPanel.jsx, audio names in TalkShowScene.jsx, line timing in a
// third array and animation direction in a fourth — joined by nothing, and each
// new episode overwrites the last. One record per episode is what makes a
// second episode possible at all.
//
// This script writes a file and nothing else. It does not touch any route, any
// component, or SitePal.
//
// Usage:
//   node scripts/lt-news-script.mjs --brief content/lt-tv/briefs/news-2026-W38.json
//   node scripts/lt-news-script.mjs --draft my-hand-written-draft.json   # no API calls
//   node scripts/lt-news-script.mjs --brief <f> --rundown-only           # just the editorial pass
//
// Env: ANTHROPIC_API_KEY (required unless --draft)
//      LT_NEWS_MODEL     (default claude-opus-5)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  CAST,
  ACTORS,
  REACTIONS,
  SEGMENTS,
  packBlocks,
  CHAR_BUDGET_PER_BLOCK,
  CHAR_LIMIT_PER_BLOCK,
  RUNTIME_BOUNDS_SECONDS,
  DELIVERY_TAGS,
  EVENT_TAGS,
  countWords,
  estimateSeconds,
  formatRuntime,
} from "./lt-tv-format.mjs";

const MODEL = process.env.LT_NEWS_MODEL || "claude-opus-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

// ── Anthropic ─────────────────────────────────────────────────────────────
//
// Raw fetch against the Messages API, matching how every other Claude call in
// this repo is written (src/app/api/trade/director, /api/review/characters,
// /api/council-chat). No SDK dependency is added for a script.

async function claude({ system, user, maxTokens = 8000 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set (or use --draft to skip the model).");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const data = await res.json();
  if (data.stop_reason === "max_tokens") {
    throw new Error("Model hit max_tokens — the reply was cut off. Raise --max-tokens and retry.");
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseJson(text);
}

/** Models occasionally wrap JSON in prose or fences despite instruction. */
function parseJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error(`Model did not return JSON:\n${text.slice(0, 400)}`);
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

// ── Pass 1: the rundown (editorial judgment) ──────────────────────────────

const RUNDOWN_SYSTEM = `You are the producer of "LT Weekly News Recap", a short animated crypto news show on the Liminal Terminal. You are handed a week of raw signal — social posts, news headlines, trending tokens, the Fear & Greed gauge, prediction-market odds — and you decide what the show covers.

You are choosing THREE stories for a six-minute show, in running order.

WHAT MAKES A GOOD STORY HERE:
- It has a number or a concrete fact in it. "Sentiment is mixed" is not a story; "six hundred million left the ETFs in four sessions" is.
- The two hosts can disagree about what it MEANS. A story everyone reads the same way is dead air.
- It happened, or turned, this week. Not a standing condition.
- Story 3 is the absurd one — the week's joke, the thing that is funny before it is instructive.

WHAT TO REJECT:
- Price predictions and anything that reads as a recommendation.
- Stories whose only source is a single anonymous social post with no corroborating headline.
- Two stories that are the same story wearing different hats.

Also pick the GAUGE beat: the Fear & Greed movement across the week (the arc from the start of the week to the end, not today's reading) and ONE prediction-market line worth quoting.

Invent nothing. Every fact, number and claim must come from the brief you are given. If the brief is thin on a slot, say so in that story's "gaps" field rather than filling it in.

Return ONLY a JSON object, no preamble and no code fences:
{
  "title": "episode title, 2-5 words, no colon",
  "summary": "one sentence for the programme guide",
  "headline": "the chiron headline bar, under 60 characters, upper-case-friendly",
  "ticker": ["4 to 6 short ticker items, each under 80 characters"],
  "stories": [
    {
      "slot": "story-1" | "story-2" | "story-3",
      "headline": "short internal headline",
      "fact": "the concrete fact with its number, one sentence",
      "tension": "what the two hosts disagree about",
      "barronAngle": "the cynical market read, one sentence",
      "gr80Angle": "the reframe — what the number actually measures, one sentence",
      "sources": [{ "title": "...", "url": "...", "outlet": "..." }],
      "gaps": "anything you could not source, or empty string"
    }
  ],
  "gauge": {
    "fearGreed": "the week's arc in one sentence, with both numbers",
    "market": "the prediction-market line with its odds, one sentence",
    "sources": [{ "title": "...", "url": "...", "outlet": "..." }]
  }
}`;

// ── Pass 2: the script ────────────────────────────────────────────────────

const SCRIPT_SYSTEM = `You are the writer of "LT Weekly News Recap", a six-minute animated news show on the Liminal Terminal — a neon devotional trading floor where cyborgs and degens pray over markets. You write the whole episode as spoken dialogue for two characters sitting at a news desk.

THE TWO HOSTS — this is the whole show, so get them exactly right:

BARRON (the anchor; old logs call him H80Z or Connor). A devilish trader who has watched a thousand pump-and-dumps and enjoyed every one. Loud, smug, market-brained, entertained by his own takes. Short staccato sentences. He distrusts velocity — "loud means cheap" — and respects silence. He treats the news as content and says so. He is never earnest for more than one line at a time, and when GR80 lands a point on him he concedes it grudgingly and immediately changes the subject.

SAINT GR80 (the co-anchor). An android monk, keeper of logs. Measured, austere, procedural, with occasional liturgical phrasing. He answers a number with what the number actually measures. He is dry rather than funny, and his jokes arrive flat and land late. He is never cruel and never preachy — he makes one observation and stops. He does not moralize at the audience; he moralizes at Barron, who deserves it.

THE BEAT PATTERN for each story: Barron states the fact with its number → GR80 reframes what the number is actually counting → Barron pushes back, usually by defending his own profession → GR80 lands the button. Six to ten lines. Vary who gets the last word across the three stories; do not let GR80 win all three.

HARD RULES:
- Every fact, number and name must come from the rundown you are given. Invent nothing. If you want a number you were not given, write the line without it.
- No financial advice, ever: no buys, sells, entries, exits, allocations, or price targets stated as fact. The characters may mock the asking.
- Each line is ONE character speaking aloud, 1 to 3 sentences. No markdown, no stage directions outside the bracket tags below, no speaker labels inside the text.
- Never say "as an AI", never mention a model, never break the frame.
- Write numbers as they are spoken: "six hundred million dollars", not "$600M". The voice model reads the text literally.

DELIVERY TAGS: put at most one bracketed delivery tag at the START of a line, and only when the reading is not obvious. Barron may use: ${DELIVERY_TAGS.Barron.join(", ")}. GR80 may use: ${DELIVERY_TAGS.Monk.join(", ")}. Roughly half of all lines should carry NO tag — a tag on every line flattens the performance.

EVENT TAGS (these produce an actual sound): ${EVENT_TAGS.join(", ")}. Use at most two in the whole episode, and NEVER as the first thing in a line — the audio pipeline trims the first 120 milliseconds of every speaker handoff and would eat it. Put an event after a few words.

DIRECT ADDRESS: set "directAddress": true on a line when the speaker is talking AT the other host rather than to the audience — the listener turns their head to face them. A statement of news is delivered to camera; a jab, a question or a rebuttal is direct address. Roughly half the lines.

ANIMATION CUES: attach reactions to lines to give the LISTENER something to do while the other talks. Each cue is { "actor": who performs it, "reaction": one of the names below, "offset": seconds after the line begins }. Barron can perform: ${Object.keys(REACTIONS.Barron).join(", ")}. GR80 can perform: ${Object.keys(REACTIONS.Monk).join(", ")}. Aim for one cue every four or five lines — the set is two people in chairs, so stillness reads as attention, and constant motion reads as a screensaver. Use headnodSubtle for ordinary agreement and save headnod for an emphatic beat. lookAround is a long clip; use it at most twice, for surveying the studio.

Return ONLY a JSON object, no preamble and no code fences:
{
  "segments": [
    {
      "id": "<the segment id you were given>",
      "lines": [
        { "actor": "Barron" | "Monk", "text": "the spoken line", "directAddress": true|false,
          "cues": [{ "actor": "Barron"|"Monk", "reaction": "...", "offset": 0.3 }] }
      ]
    }
  ]
}
"cues" may be an empty array. Write every segment you are given, in order.`;

function scriptUserMessage(rundown, week) {
  const skeleton = SEGMENTS.map(
    (s) => `- ${s.id} ("${s.label}"), target ${s.targetWords} spoken words. ${s.intent}`,
  ).join("\n");

  return `Week: ${week}

THE RUNDOWN
${JSON.stringify(rundown, null, 2)}

THE SEGMENTS, in order — write all six:
${skeleton}

Hit the word targets within about fifteen percent. They add up to a six-minute episode, and the show has to land between five and ten minutes.`;
}

// ── Assembly ──────────────────────────────────────────────────────────────
//
// Turns the writer's segments into the episode record: global line numbering,
// recording blocks under the character budget, derived runtime, and a warning
// list. Assembly is deliberately local and deterministic — the model writes
// words, this code owns every number.

function assemble({ rundown, segments, week, brief }) {
  const warnings = [];
  const bySegment = new Map(segments.map((s) => [s.id, s]));

  let n = 0;
  const outSegments = [];

  for (const spec of SEGMENTS) {
    const written = bySegment.get(spec.id);
    if (!written) {
      warnings.push(`Segment "${spec.id}" is missing from the script.`);
      continue;
    }

    const lines = [];
    for (const line of written.lines || []) {
      if (!ACTORS.includes(line.actor)) {
        warnings.push(`Line ${n}: unknown actor "${line.actor}" — dropped.`);
        continue;
      }
      const text = String(line.text || "").trim();
      if (!text) {
        warnings.push(`Line ${n}: empty text — dropped.`);
        continue;
      }

      const cues = [];
      for (const cue of line.cues || []) {
        const table = REACTIONS[cue.actor];
        if (!table) {
          warnings.push(`Line ${n}: cue names unknown actor "${cue.actor}" — dropped.`);
          continue;
        }
        if (!(cue.reaction in table)) {
          warnings.push(
            `Line ${n}: ${cue.actor} has no reaction "${cue.reaction}" — dropped. ` +
              `Valid: ${Object.keys(table).join(", ")}.`,
          );
          continue;
        }
        cues.push({
          actor: cue.actor,
          reaction: cue.reaction,
          offset: Number(cue.offset ?? 0.3),
          // Full authored clip length; trim per episode if the gesture finishes early.
          duration: table[cue.reaction],
        });
      }

      // An event tag at the very start of a line is eaten by the handoff trim.
      const leadingEvent = EVENT_TAGS.find((t) => text.startsWith(t));
      if (leadingEvent) {
        warnings.push(
          `Line ${n}: opens with the event tag ${leadingEvent}; the 120ms handoff trim will eat it. Move it a few words in.`,
        );
      }

      lines.push({
        n,
        actor: line.actor,
        voiceId: CAST[line.actor].voiceId,
        text,
        // Only two seats, so the listener is always the other one — derived, never
        // hand-restated, which is how the speaker mapping drifts today.
        directAddress: Boolean(line.directAddress),
        cues,
      });
      n += 1;
    }

    const words = lines.reduce((sum, l) => sum + countWords(l.text), 0);
    const drift = spec.targetWords ? (words - spec.targetWords) / spec.targetWords : 0;
    if (Math.abs(drift) > 0.25) {
      warnings.push(
        `Segment "${spec.id}": ${words} words against a ${spec.targetWords} target (${drift > 0 ? "+" : ""}${Math.round(drift * 100)}%).`,
      );
    }

    outSegments.push({
      id: spec.id,
      label: spec.label,
      words,
      estimatedSeconds: Number(estimateSeconds(words).toFixed(1)),
      lines,
    });
  }

  // Recording blocks: each is one ElevenLabs request, generated in context.
  // Packed from this episode's actual lengths, so a long week re-packs instead
  // of silently overrunning the request ceiling.
  const segmentChars = outSegments.map((s) => ({
    id: s.id,
    chars: s.lines.reduce((sum, l) => sum + l.text.length, 0),
  }));

  const blocks = packBlocks(segmentChars).map((blockSpec) => {
    const lines = outSegments
      .filter((s) => blockSpec.segments.includes(s.id))
      .flatMap((s) => s.lines);
    const chars = lines.reduce((sum, l) => sum + l.text.length, 0);
    if (chars > CHAR_LIMIT_PER_BLOCK) {
      warnings.push(
        `${blockSpec.id}: ${chars} characters exceeds the ${CHAR_LIMIT_PER_BLOCK} ElevenLabs ceiling — split it before generating.`,
      );
    } else if (chars > CHAR_BUDGET_PER_BLOCK) {
      warnings.push(`${blockSpec.id}: ${chars} characters is over the ${CHAR_BUDGET_PER_BLOCK} target but under the ceiling.`);
    }
    return {
      id: blockSpec.id,
      segments: blockSpec.segments,
      chars,
      firstLine: lines[0]?.n ?? null,
      lastLine: lines[lines.length - 1]?.n ?? null,
      // Filled in by the audio build once this block has been generated.
      durationSeconds: null,
      offsetSeconds: null,
    };
  });

  const words = outSegments.reduce((sum, s) => sum + s.words, 0);
  const seconds = estimateSeconds(words);
  if (seconds < RUNTIME_BOUNDS_SECONDS.min || seconds > RUNTIME_BOUNDS_SECONDS.max) {
    warnings.push(
      `Estimated runtime ${formatRuntime(seconds)} falls outside the ${formatRuntime(RUNTIME_BOUNDS_SECONDS.min)}–${formatRuntime(RUNTIME_BOUNDS_SECONDS.max)} window.`,
    );
  }

  const sources = [
    ...(rundown.stories || []).flatMap((s) => s.sources || []),
    ...(rundown.gauge?.sources || []),
  ].filter((s) => s && s.title);

  return {
    id: `news-${week}`,
    show: "news",
    week,
    title: rundown.title,
    summary: rundown.summary,
    airDate: new Date().toISOString().slice(0, 10),

    // What the LT TV slate and the chiron read. Today EPISODES in
    // LTTvBroadcastPanel.jsx and TICKER_COPY in LTTvChiron.jsx are hardcoded;
    // these are the fields that would replace them.
    slate: {
      runtime: formatRuntime(seconds),
      estimatedSeconds: Number(seconds.toFixed(1)),
      words,
    },
    graphics: {
      mode: "news",
      headline: rundown.headline,
      ticker: rundown.ticker || [],
    },

    cast: Object.fromEntries(
      ACTORS.map((a) => [
        a,
        {
          displayName: CAST[a].displayName,
          voiceId: CAST[a].voiceId,
          processorKey: CAST[a].processorKey,
          // The SitePal Audio Manager clip name. Null until the audio is built
          // and uploaded; this is the join that does not exist in the repo today.
          sitepalAudio: null,
        },
      ]),
    ),

    segments: outSegments,
    blocks,

    // Populated by the audio build from talk-show-timing.json, per block, with
    // each block's starts shifted by the summed duration of the blocks before it.
    timing: { lineStarts: null, lineEnds: null, durationSeconds: null, leadIn: 2.5 },

    rundown,
    sources,
    provenance: {
      briefId: brief?.id ?? null,
      briefGeneratedAt: brief?.generatedAt ?? null,
      model: MODEL,
      generatedAt: new Date().toISOString(),
      pipeline: "scripts/lt-news-script.mjs",
    },
    warnings,
  };
}

/** The human-readable read-through. The JSON is for machines; this is for ears. */
export function renderScript(episode) {
  const out = [
    `LT WEEKLY NEWS RECAP — ${episode.title}`,
    `${episode.week}   ·   ${episode.slate.runtime} estimated   ·   ${episode.slate.words} words`,
    "",
    `CHIRON: ${episode.graphics.headline}`,
    "",
  ];
  for (const segment of episode.segments) {
    out.push(`── ${segment.label.toUpperCase()} — ${segment.words} words, ~${Math.round(segment.estimatedSeconds)}s`, "");
    for (const line of segment.lines) {
      const who = CAST[line.actor].displayName.toUpperCase().padEnd(10);
      out.push(`${String(line.n).padStart(3)}  ${who} ${line.text}`);
      for (const cue of line.cues) {
        out.push(`     ${" ".repeat(10)} (${cue.actor} ${cue.reaction} @ +${cue.offset}s)`);
      }
    }
    out.push("");
  }
  return out.join("\n");
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const draftPath = arg("draft");
  const briefPath = arg("brief");

  let brief = null;
  let rundown;
  let segments;
  let week;

  if (draftPath && draftPath !== true) {
    // Hand-written or hand-edited draft: assemble it without calling the model.
    const draft = JSON.parse(await readFile(resolve(draftPath), "utf8"));
    ({ rundown, segments, week } = draft);
    if (draft.brief) brief = draft.brief;
  } else {
    if (!briefPath || briefPath === true) {
      throw new Error("Pass --brief <path to a brief JSON>, or --draft <path to a draft JSON>.");
    }
    brief = JSON.parse(await readFile(resolve(briefPath), "utf8"));
    week = brief.week;

    console.log(`Rundown pass (${MODEL})…`);
    rundown = await claude({
      system: RUNDOWN_SYSTEM,
      user: `Week: ${week}\n\nTHE BRIEF\n${JSON.stringify(brief.signals, null, 2)}`,
      maxTokens: 4000,
    });

    if (arg("rundown-only")) {
      const out = resolve(arg("out", `content/lt-tv/briefs/rundown-${week}.json`));
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify(rundown, null, 2) + "\n");
      console.log(`Wrote ${out}`);
      return;
    }

    console.log("Script pass…");
    const written = await claude({
      system: SCRIPT_SYSTEM,
      user: scriptUserMessage(rundown, week),
      maxTokens: 12000,
    });
    segments = written.segments;
  }

  const episode = assemble({ rundown, segments, week, brief });

  const jsonPath = resolve(arg("out", `content/lt-tv/episodes/${episode.id}.json`));
  const txtPath = jsonPath.replace(/\.json$/, ".txt");
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(episode, null, 2) + "\n");
  await writeFile(txtPath, renderScript(episode) + "\n");

  console.log(
    `\n${episode.title} — ${episode.slate.runtime}, ${episode.slate.words} words, ` +
      `${episode.segments.reduce((n, s) => n + s.lines.length, 0)} lines`,
  );
  console.log(`Blocks: ${episode.blocks.map((b) => `${b.id} ${b.chars}c`).join(", ")}`);
  if (episode.warnings.length) {
    console.log(`\n${episode.warnings.length} warning(s):`);
    for (const w of episode.warnings) console.log(`  · ${w}`);
  } else {
    console.log("\nNo warnings.");
  }
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${txtPath}`);
}

// Only run when invoked directly, so assemble/renderScript can be imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

export { assemble };
