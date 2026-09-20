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
//   node scripts/lt-news-script.mjs --brief <f> --no-search               # skip source verification
//
// Env: ANTHROPIC_API_KEY (required unless --draft)
//      LT_NEWS_MODEL     (default claude-opus-5)

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  CAST,
  ACTORS,
  REACTIONS,
  SEGMENTS,
  OPTIONAL_SEGMENTS,
  packBlocks,
  sitepalClipName,
  NEWS_SOURCE_DOMAINS,
  MAX_SEARCHES_PER_RUNDOWN,
  WEB_SEARCH_TOOL_TYPE,
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

async function claude({ system, user, maxTokens = 8000, tools = null }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set (or use --draft to skip the model).");

  const messages = [{ role: "user", content: user }];
  const searchNotes = [];
  let data;

  // Server-side tools run on Anthropic's side, but a long tool-using turn can
  // come back as `pause_turn` — resume it by echoing the content back and
  // asking for the rest. Bounded so a misbehaving turn cannot loop forever.
  for (let attempt = 0; attempt < 6; attempt += 1) {
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
        messages,
        ...(tools ? { tools } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }

    data = await res.json();

    // A server-tool failure arrives as a 200 with an error object in place of
    // the usual result list. The show degrades rather than dying: an
    // unverified rundown is worse than a verified one, but far better than no
    // episode at all.
    for (const block of data.content || []) {
      if (block.type === "web_search_tool_result" && !Array.isArray(block.content)) {
        searchNotes.push(`web search unavailable: ${block.content?.error_code ?? "unknown error"}`);
      }
    }

    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }

  if (data.stop_reason === "max_tokens") {
    throw new Error("Model hit max_tokens — the reply was cut off. Raise --max-tokens and retry.");
  }
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined this request. Check the brief for anything unexpected.");
  }

  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseJson(text);
  if (searchNotes.length) parsed._searchNotes = searchNotes;
  return parsed;
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

const RUNDOWN_SYSTEM = `You are the producer of "LT Weekly News Recap", a short animated news show about investing and economics that lives on the Liminal Terminal, a neon devotional trading floor. You are handed a week of raw signal and you decide what the show covers.

THE BEAT IS GENERAL INVESTING AND ECONOMICS — NOT CRYPTO.
A typical week is the Fed and interest rates, the ten-year Treasury, the price of oil, a bill moving through Congress, what the indices did — and then crypto, and then whatever people have newly decided is an asset. Crypto is one beat among several, not the default. If you pick three crypto stories you have produced the wrong show.

The signal you are given is grouped: macro (Fed press releases, the Treasury yield curve, economy headlines), markets (index and commodity levels week over week), crypto, collectibles (the trading-card and memorabilia beat — set launches, manias, people buying things as investments), and predictions (Polymarket and Kalshi odds).

You are choosing THREE stories for a six-to-seven-minute show, in running order. Spread them across beats: if story one is macro, story two should not be. Story three is usually the absurd one, and collectibles live there naturally.

WHAT MAKES A GOOD STORY HERE:
- It has a number or a concrete fact in it. "Sentiment is mixed" is not a story; "six hundred million left the ETFs in four sessions" is.
- The two hosts can disagree about what it MEANS. A story everyone reads the same way is dead air.
- It happened, or turned, this week. Not a standing condition.
- Story 3 is the absurd one — the week's joke, the thing that is funny before it is instructive.

WHAT TO REJECT:
- Price predictions and anything that reads as a recommendation.
- Stories whose only source is a single anonymous social post with no corroborating headline.
- Two stories that are the same story wearing different hats.

Also pick THE BOARD: the three or four numbers that actually moved this week, read as a board. Candidates are the ten-year Treasury yield and its direction, the Fear & Greed arc across the week (the arc, not today's reading), oil or gold if either moved meaningfully, and the indices. Plus ONE prediction-market line from Polymarket or Kalshi worth quoting, with its odds. Do not recite every number you were given — pick what moved.

HOW TO SOURCE A STORY — the brief nominates, the web confirms:
The brief you are given is made of headlines and social posts. It is enough to tell you what the week was ABOUT and nowhere near enough to read a number out loud on air. So:
1. Pick your three candidate stories from the brief.
2. SEARCH to confirm each one before you write it, using the web_search tool. Find the number, the date and a real article from a reputable outlet.
3. Put the article you actually confirmed it from in that story's "sources", with its real URL and outlet. A source you did not read does not go in the list.
4. Do the same for the board's prediction-market line and any number on it you did not get from the brief's own price data.

If a search does not confirm a story, you have three honest options, in this order: replace it with one you CAN confirm; keep it but strip the unconfirmed number out of "fact" and say so in "gaps"; or, if the week is genuinely thin, return fewer than three stories. Never keep a number you could not confirm.

If the web search tool is unavailable to you, work from the brief alone, put "unverified — from headline only" in every affected story's "gaps", and do not state a number that appears nowhere in the brief.

Invent nothing, ever. No number, date, name or quote may come from your own memory — only from the brief or from something you searched and read. Your training data is older than this week.

Return ONLY a JSON object, no preamble and no code fences:
{
  "title": "episode title, 2-5 words, no colon",
  "summary": "one sentence for the programme guide",
  "headline": "the chiron headline bar, under 60 characters, upper-case-friendly",
  "ticker": ["4 to 6 short ticker items, each under 80 characters"],
  "stories": [
    {
      "slot": "story-1" | "story-2" | "story-3",
      "beat": "macro" | "markets" | "crypto" | "collectibles" | "predictions",
      "headline": "short internal headline",
      "fact": "the concrete fact with its number, one sentence",
      "tension": "what the two hosts disagree about",
      "barronAngle": "the cynical market read, one sentence",
      "gr80Angle": "the reframe — what the number actually measures, one sentence",
      "sources": [{ "title": "...", "url": "...", "outlet": "..." }],
      "verified": true | false,
      "gaps": "anything you could not source or confirm, or empty string"
    }
  ],
  "board": {
    "lines": ["3 to 4 short sentences, each one number that moved and its direction"],
    "market": "the prediction-market line with its odds and its venue, one sentence",
    "sources": [{ "title": "...", "url": "...", "outlet": "..." }]
  }
}`;

// The ad copy is a file a human keeps current — the show's one hand-fed input.
// No copy means no ad break that week, which is a normal week.
async function readSpots(path = "content/lt-tv/rl80-spots.md") {
  try {
    const text = await readFile(resolve(path), "utf8");
    // Bullets under "Retired" are kept for reuse but are not in rotation.
    const live = text.split(/^##\s+Retired/m)[0];
    return live
      .split("\n")
      .filter((line) => /^-\s+\S/.test(line))
      .map((line) => line.replace(/^-\s+/, "").trim());
  } catch {
    return [];
  }
}

// ── Pass 2: the script ────────────────────────────────────────────────────

const SCRIPT_SYSTEM = `You are the writer of "LT Weekly News Recap", a six-minute animated news show about investing and economics, broadcast from the Liminal Terminal — a neon devotional trading floor where cyborgs and degens pray over markets. You write the whole episode as spoken dialogue for two characters sitting at a news desk.

THE BEAT IS GENERAL INVESTING AND ECONOMICS. Interest rates, Treasury yields, oil, legislation, the indices, crypto, and whatever people are currently buying as an investment. Write it as a market show that takes all of it equally seriously, which is to say not very.

THE TWO HOSTS — this is the whole show, so get them exactly right:

BARRON (the anchor; old logs call him H80Z or Connor). A devilish trader who has watched a thousand pump-and-dumps and enjoyed every one. Loud, smug, market-brained, entertained by his own takes. Short staccato sentences. He distrusts velocity — "loud means cheap" — and respects silence. He treats the news as content and says so. He is never earnest for more than one line at a time, and when GR80 lands a point on him he concedes it grudgingly and immediately changes the subject.

SAINT GR80 (the co-anchor). An android monk, keeper of logs. Measured, austere, procedural, with occasional liturgical phrasing. He answers a number with what the number actually measures. He is dry rather than funny, and his jokes arrive flat and land late. He is never cruel and never preachy — he makes one observation and stops. He does not moralize at the audience; he moralizes at Barron, who deserves it.

THE BEAT PATTERN for each story: Barron states the fact with its number → GR80 reframes what the number is actually counting → Barron pushes back, usually by defending his own profession → GR80 lands the button. Six to ten lines. Vary who gets the last word across the three stories; do not let GR80 win all three.

HARD RULES:
- Every fact, number and name must come from the rundown you are given. Invent nothing. If you want a number you were not given, write the line without it.
- No financial advice, ever: no buys, sells, entries, exits, allocations, or price targets stated as fact. The characters may mock the asking.
- Each line is ONE character speaking aloud, 1 to 3 sentences. No markdown, no stage directions outside the bracket tags below, no speaker labels inside the text.
- Alternate speakers. Never give the same host two turns in a row — the camera cuts on who is speaking, so a double turn holds on one face while the other sits idle. If a host needs two thoughts, put them in one line.
- Never say "as an AI", never mention a model, never break the frame.
- Write numbers as they are spoken: "six hundred million dollars", not "$600M". The voice model reads the text literally.

DELIVERY TAGS: put at most one bracketed delivery tag at the START of a line, and only when the reading is not obvious. Barron may use: ${DELIVERY_TAGS.Barron.join(", ")}. GR80 may use: ${DELIVERY_TAGS.Monk.join(", ")}. Roughly half of all lines should carry NO tag — a tag on every line flattens the performance.

EVENT TAGS (these produce an actual sound): ${EVENT_TAGS.join(", ")}. Use at most two in the whole episode, and NEVER as the first thing in a line — the audio pipeline trims the first 120 milliseconds of every speaker handoff and would eat it. Put an event after a few words.

DIRECT ADDRESS: set "directAddress": true on a line when the speaker is talking AT the other host rather than to the audience — the listener turns their head to face them. A statement of news is delivered to camera; a jab, a question or a rebuttal is direct address. Roughly half the lines.

ANIMATION CUES: attach reactions to lines to give the LISTENER something to do while the other talks. Each cue is { "actor": who performs it, "reaction": one of the names below, "offset": seconds after the line begins }. Barron can perform: ${Object.keys(REACTIONS.Barron).join(", ")}. GR80 can perform: ${Object.keys(REACTIONS.Monk).join(", ")}. Aim for one cue every four or five lines — the set is two people in chairs, so stillness reads as attention, and constant motion reads as a screensaver. Use headnodSubtle for ordinary agreement and save headnod for an emphatic beat. lookAround is a long clip; use it at most twice, for surveying the studio.

THE SPOT — the ad break, when you are given copy for it:
Play it completely straight for as long as you can bear. Barron does the sponsor voice: grand, overclaimed, delighted with himself, the register of a man reading a script he was paid for and believes anyway. Then GR80 reads the disclaimer as though it were scripture, or refuses to read it, or reads it correctly in a way that ruins the ad. Fifty-odd words, in and out.
It is a joke ABOUT advertising. It never tells anyone to buy anything, it states no price, no return and no yield figure, and "not a recommendation" is the punchline rather than a caption. If you are given no spot copy, omit the "the-spot" segment entirely.

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

function scriptUserMessage(rundown, week, spots) {
  // A week with no ad copy simply does not get the segment offered to it.
  const running = SEGMENTS.filter((s) => !(s.id === "the-spot" && !spots.length));
  const skeleton = running
    .map((s) => `- ${s.id} ("${s.label}"), target ${s.targetWords} spoken words. ${s.intent}`)
    .join("\n");

  const spotBlock = spots.length
    ? `\nSPOT COPY — pick exactly ONE of these for "the-spot" and build the ad read around it:\n${spots
        .map((line) => `- ${line}`)
        .join("\n")}\n`
    : "\nThere is no spot copy this week, so do NOT write a \"the-spot\" segment.\n";

  return `Week: ${week}

THE RUNDOWN
${JSON.stringify(rundown, null, 2)}
${spotBlock}
THE SEGMENTS, in order — write all ${running.length}:
${skeleton}

Hit the word targets within about fifteen percent. They add up to a six-and-a-half-minute episode, and the show has to land between five and ten minutes.`;
}

// ── Assembly ──────────────────────────────────────────────────────────────
//
// Turns the writer's segments into the episode record: global line numbering,
// recording blocks under the character budget, derived runtime, and a warning
// list. Assembly is deliberately local and deterministic — the model writes
// words, this code owns every number.

function assemble({ rundown, segments, week, brief, number = 1 }) {
  const warnings = [];
  const bySegment = new Map(segments.map((s) => [s.id, s]));

  let n = 0;
  const outSegments = [];

  for (const spec of SEGMENTS) {
    const written = bySegment.get(spec.id);
    if (!written || !(written.lines || []).length) {
      // The spot is skipped in a week with no ad copy — that is normal, not a gap.
      if (!OPTIONAL_SEGMENTS.has(spec.id)) {
        warnings.push(`Segment "${spec.id}" is missing from the script.`);
      }
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

      // Two turns in a row from the same host is almost always a writing slip:
      // the camera derives its shot from who is speaking (TALK_SHOW_SHOTS), so
      // the set just holds on one face while the other sits idle.
      if (lines.length && lines[lines.length - 1].actor === line.actor) {
        warnings.push(
          `Line ${n}: ${line.actor} speaks twice in a row — merge the turns or put a line between them.`,
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

  for (const story of rundown.stories || []) {
    if (story.verified === false) {
      const detail = String(story.gaps || "no detail given").replace(/[.\s]+$/, "");
      warnings.push(`Story "${story.headline}" is UNVERIFIED — ${detail}.`);
    }
  }

  const sources = [
    ...(rundown.stories || []).flatMap((s) => s.sources || []),
    ...(rundown.board?.sources || []),
  ].filter((s) => s && s.title);

  return {
    id: `news-${week}`,
    show: "news",
    week,
    number: String(number).padStart(2, "0"),
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
          // The name to give this character's upload in SitePal's Audio Manager.
          // Prescribed rather than left blank: the account has one shared Audio
          // Manager, TalkShowScene resolves clips by name, and a mismatch is a
          // silent failure to speak — so the record states the name and the
          // producer types it, instead of inventing one and copying it back.
          sitepalAudio: sitepalClipName("news", number, a),
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

/**
 * Episode number for the slate and the SitePal clip name. Explicit via
 * --number, otherwise one past however many news records already exist — so a
 * normal weekly run needs no argument and a re-run of an existing week is
 * corrected by hand rather than silently renumbering.
 */
async function resolveEpisodeNumber() {
  const flag = arg("number");
  if (flag && flag !== true) return Number(flag);
  try {
    const files = await readdir(resolve("content/lt-tv/episodes"));
    return files.filter((f) => /^news-.*\.json$/.test(f)).length + 1;
  } catch {
    return 1;
  }
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

    const search = arg("no-search") ? null : [
      {
        type: WEB_SEARCH_TOOL_TYPE,
        name: "web_search",
        max_uses: MAX_SEARCHES_PER_RUNDOWN,
        allowed_domains: NEWS_SOURCE_DOMAINS,
      },
    ];

    console.log(`Rundown pass (${MODEL})${search ? " with source verification" : " — search disabled"}…`);
    rundown = await claude({
      system: RUNDOWN_SYSTEM,
      user: `Week: ${week}\n\nTHE BRIEF\n${JSON.stringify(brief.signals, null, 2)}`,
      maxTokens: 8000,
      tools: search,
    });

    for (const note of rundown._searchNotes || []) console.log(`  ! ${note}`);
    delete rundown._searchNotes;

    const unverified = (rundown.stories || []).filter((story) => story.verified === false);
    if (unverified.length) {
      console.log(
        `  ! ${unverified.length} of ${rundown.stories.length} stories could not be confirmed: ` +
          unverified.map((story) => `"${story.headline}"`).join(", "),
      );
    }

    if (arg("rundown-only")) {
      const out = resolve(arg("out", `content/lt-tv/briefs/rundown-${week}.json`));
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify(rundown, null, 2) + "\n");
      console.log(`Wrote ${out}`);
      return;
    }

    const spots = await readSpots();
    console.log(`Script pass… ${spots.length ? `(${spots.length} spot(s) available)` : "(no ad break this week)"}`);
    const written = await claude({
      system: SCRIPT_SYSTEM,
      user: scriptUserMessage(rundown, week, spots),
      maxTokens: 16000,
    });
    segments = written.segments;
  }

  const number = await resolveEpisodeNumber();
  const episode = assemble({ rundown, segments, week, brief, number });

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
