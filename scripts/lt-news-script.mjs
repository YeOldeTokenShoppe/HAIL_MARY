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

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  CAST,
  ACTORS,
  REACTIONS,
  SEGMENTS,
  OPTIONAL_SEGMENTS,
  SHOW_FORMATS,
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
  TITLE_RULES,
  SPOKEN_ACRONYMS,
  ACRONYMS_TAKEN_AS_READ,
  countWords,
  estimateSeconds,
  formatRuntime,
} from "./lt-tv-format.mjs";
import { toSlateRecord, writeSlateRecord, SLATE_DIR, SLATE_INDEX } from "./lt-tv-slate-record.mjs";
import { assemble, renderScript } from "./lt-tv-episode.mjs";
import { arg, rejectUnknownFlags } from "./lt-tv-cli.mjs";
import { claude as callClaude } from "./lt-tv-claude.mjs";
import { readStyleNotes, withStyleNotes } from "./lt-tv-style-notes.mjs";

const claude = (opts) => callClaude({ ...opts, model: MODEL });

const MODEL = process.env.LT_NEWS_MODEL || "claude-opus-5";

// Every flag this script knows. An unrecognised one is almost always a typo,
// and silently ignoring it is how `--check-sources.` — one stray full stop —
// quietly generated a brief instead of checking anything.
const KNOWN_FLAGS = ["brief", "draft", "rundown-only", "no-search", "number", "out", "max-tokens", "slate", "no-slate"];

// The max_tokens error tells you to raise --max-tokens, so --max-tokens has to
// actually do something.
const MAX_TOKENS = { rundown: 8000, dialogue: 16000 };

function maxTokensOverride() {
  const raw = arg("max-tokens");
  if (!raw || raw === true) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`--max-tokens expects a positive number, got "${raw}".`);
    process.exit(2);
  }
  return Math.round(n);
}

function maxTokensFor(pass) {
  const n = maxTokensOverride();
  if (n === null) return MAX_TOKENS[pass];
  // The value given names the rundown pass. Dialogue keeps the 2x ratio the
  // defaults have, because it writes roughly twice as much.
  return pass === "dialogue" ? n * 2 : n;
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

${TITLE_RULES}

Return ONLY a JSON object, no preamble and no code fences:
{
  "title": "the episode title, written to the title rules above",
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
      "connorAngle": "the cynical market read, one sentence",
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

CONNOR (the anchor; the animation config and old logs also call him Connor or H80Z). The devil's advocate, and he knows it. An inside trader and a short-seller who has watched a thousand pump-and-dumps and enjoyed every one, and who is completely honest about who he is: he reads the news as a man who trades on it and says so. Loud, smug, market-brained, entertained by his own takes. Short staccato sentences. He distrusts velocity — "loud means cheap" — and respects silence. He treats the news as content and says so. He is funny and a good sparring partner for GR80: not detestable, not a villain, but NOT sweet and NOT empathetic — warmth from Connor comes out as a joke, a bet, or a grudging compliment, never as sympathy. He is never earnest for more than one line at a time, and when GR80 lands a point on him he concedes it grudgingly and immediately changes the subject.

SAINT GR80 (the co-anchor). An android monk, keeper of logs. Measured, austere, procedural, with occasional liturgical phrasing. He answers a number with what the number actually measures. He is dry rather than funny, and his jokes arrive flat and land late. He is never cruel and never preachy — he makes one observation and stops. He does not moralize at the audience; he moralizes at Connor, who deserves it.

THE BEAT PATTERN for each story: Connor states the fact with its number → GR80 reframes what the number is actually counting → Connor pushes back, usually by defending his own profession → GR80 lands the button. Six to ten lines. Vary who gets the last word across the three stories; do not let GR80 win all three.

HARD RULES:
- Every fact, number and name must come from the rundown you are given. Invent nothing. If you want a number you were not given, write the line without it.
- No financial advice, ever: no buys, sells, entries, exits, allocations, or price targets stated as fact. The characters may mock the asking.
- Each line is ONE character speaking aloud, 1 to 3 sentences. No markdown, no stage directions outside the bracket tags below, no speaker labels inside the text.
- Alternate speakers. Never give the same host two turns in a row — the camera cuts on who is speaking, so a double turn holds on one face while the other sits idle. If a host needs two thoughts, put them in one line.
- Never say "as an AI", never mention a model, never break the frame.
- Write numbers as they are spoken: "six hundred million dollars", not "$600M". The voice model reads the text literally.

SAY WHAT THE LETTERS STAND FOR. Nobody is reading this show; they are hearing it, and an acronym nobody expands is a noise. The FIRST time an acronym is spoken in the episode, say what it stands for in the same line, then use the short form for the rest of the episode: "Federal Reserve Economic Data — FRED to its friends" the first time, "FRED" every time after. Expand it in the character's own voice, as part of the sentence; it is a line of dialogue, not a footnote, and Connor explaining an acronym impatiently is in character. This applies to: ${Object.keys(SPOKEN_ACRONYMS).join(", ")}. It does NOT apply to these, which everyone already says out loud and which sound patronising expanded: ${ACRONYMS_TAKEN_AS_READ.join(", ")}.

DELIVERY TAGS: put at most one bracketed delivery tag at the START of a line, and only when the reading is not obvious. Connor may use: ${DELIVERY_TAGS.Connor.join(", ")}. GR80 may use: ${DELIVERY_TAGS.Monk.join(", ")}. Roughly half of all lines should carry NO tag — a tag on every line flattens the performance.

EVENT TAGS (these produce an actual sound): ${EVENT_TAGS.join(", ")}. Use at most two in the whole episode, and NEVER as the first thing in a line — the audio pipeline trims the first 120 milliseconds of every speaker handoff and would eat it. Put an event after a few words.

DIRECT ADDRESS: set "directAddress": true on a line when the speaker is talking AT the other host rather than to the audience — the listener turns their head to face them. A statement of news is delivered to camera; a jab, a question or a rebuttal is direct address. Roughly half the lines.

ANIMATION CUES: attach reactions to lines to give the LISTENER something to do while the other talks. Each cue is { "actor": who performs it, "reaction": one of the names below, "offset": seconds after the line begins }. Connor can perform: ${Object.keys(REACTIONS.Connor).join(", ")}. GR80 can perform: ${Object.keys(REACTIONS.Monk).join(", ")}. Aim for one cue every four or five lines — the set is two people in chairs, so stillness reads as attention, and constant motion reads as a screensaver. Use headnodSubtle for ordinary agreement and save headnod for an emphatic beat. lookAround is a long clip; use it at most twice, for surveying the studio.

THE SPOT — the ad break, when you are given copy for it:
Play it completely straight for as long as you can bear. Connor does the sponsor voice: grand, overclaimed, delighted with himself, the register of a man reading a script he was paid for and believes anyway. Then GR80 reads the disclaimer as though it were scripture, or refuses to read it, or reads it correctly in a way that ruins the ad. Fifty-odd words, in and out.
It is a joke ABOUT advertising. It never tells anyone to buy anything, it states no price, no return and no yield figure, and "not a recommendation" is the punchline rather than a caption. If you are given no spot copy, omit the "the-spot" segment entirely.

Return ONLY a JSON object, no preamble and no code fences:
{
  "segments": [
    {
      "id": "<the segment id you were given>",
      "lines": [
        { "actor": "Connor" | "Monk", "text": "the spoken line", "directAddress": true|false,
          "cues": [{ "actor": "Connor"|"Monk", "reaction": "...", "offset": 0.3 }] }
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

/**
 * Episode number for the slate and the SitePal clip name. Explicit via
 * --number, otherwise one past however many news records already exist — so a
 * normal weekly run needs no argument and a re-run of an existing week is
 * corrected by hand rather than silently renumbering.
 */
/**
 * Which episode of the news show this is.
 *
 * The number is not cosmetic: it names the slate record (news-03.json) and it
 * names both SitePal uploads (lttv_news_ep03_connor). So it has to be the same
 * number every time this week is built, or a re-run silently becomes a second
 * episode with a second pair of clip names.
 *
 * It is therefore read from the SLATE, which is the list of episodes that
 * actually exist, and a week already on the slate keeps the number it was
 * given. Counting the staging directory — which is what this did — allocated a
 * fresh number on every re-run, because each run leaves another file there.
 */
async function resolveEpisodeNumber(week) {
  const flag = arg("number");
  if (flag && flag !== true) {
    const n = Number(flag);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`--number expects a whole number from 1, got "${flag}".`);
      process.exit(2);
    }
    return n;
  }

  let records = [];
  try {
    const dir = resolve(SLATE_DIR);
    const files = (await readdir(dir)).filter((f) => /^news-\d+\.json$/.test(f));
    records = await Promise.all(
      files.map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8"))),
    );
  } catch {
    return 1; // no slate yet
  }

  const existing = records.find((r) => r.week === week);
  if (existing) {
    console.log(`Week ${week} is already episode ${existing.number} on the slate — reusing that number.`);
    return Number(existing.number);
  }
  return records.length + 1;
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  rejectUnknownFlags(KNOWN_FLAGS);
  // Checked up front, not at the call site: --draft never reaches the model,
  // and a bad value should still be a typo you hear about immediately.
  maxTokensOverride();

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

    // Standing corrections from docs/lt-tv-style-notes.md, sent with both
    // passes: a rule can be about what is worth covering as much as about how
    // a line is written.
    const houseNotes = await readStyleNotes();
    if (houseNotes.length) console.log(`House notes: ${houseNotes.length} in force.`);
    console.log(`Rundown pass (${MODEL})${search ? " with source verification" : " — search disabled"}…`);
    rundown = await claude({
      system: withStyleNotes(RUNDOWN_SYSTEM, houseNotes),
      user: `Week: ${week}\n\nTHE BRIEF\n${JSON.stringify(brief.signals, null, 2)}`,
      maxTokens: maxTokensFor("rundown"),
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
      system: withStyleNotes(SCRIPT_SYSTEM, houseNotes),
      user: scriptUserMessage(rundown, week, spots),
      maxTokens: maxTokensFor("dialogue"),
    });
    segments = written.segments;
  }

  const number = await resolveEpisodeNumber(week);
  const episode = assemble({
    rundown, segments, week, brief, number,
    producedBy: { model: MODEL, pipeline: "scripts/lt-news-script.mjs" },
  });

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
  await retireWeekNamedCopy(week, episode.id);

  await emitSlateRecord(episode, { fromDraft: Boolean(arg("draft")) });
}

/**
 * Until 2026-09-21 a news episode was staged under its week (news-2026-W39)
 * while the slate called it news-01, and nothing downstream could find it. A
 * week written under the old name is superseded by the numbered record this
 * run just wrote for the same week, so the old pair is removed rather than
 * left to show up in the studio as a second, unrecordable episode.
 */
async function retireWeekNamedCopy(week, id) {
  const stale = resolve(`content/lt-tv/episodes/news-${week}.json`);
  if (`news-${week}` === id || !existsSync(stale)) return;
  await rm(stale);
  await rm(stale.replace(/\.json$/, ".txt"), { force: true });
  console.log(`Removed the older copy news-${week}.json — this week is ${id} now.`);
}

/**
 * Put the episode on the LT TV guide.
 *
 * A draft does not land by default. `--draft` exists to look at the format and
 * hear the two voices; the worked sample in content/lt-tv/samples is marked
 * synthetic and its numbers are invented, so a draft run must not be one typo
 * away from listing it as an episode of the show. `--slate` forces it when you
 * are deliberately testing this path; `--no-slate` suppresses it always.
 */
async function emitSlateRecord(episode, { fromDraft }) {
  if (arg("no-slate")) return;
  if (fromDraft && !arg("slate")) {
    console.log("\nNot added to the slate (draft run). Pass --slate to add it anyway.");
    return;
  }

  const record = toSlateRecord(episode);
  const { path, registered, importLine, arrayLine } = await writeSlateRecord(record);

  console.log(`\nWrote ${path}`);
  if (registered) {
    console.log(`Registered in ${SLATE_INDEX}.`);
  } else {
    console.log(`Could NOT register it in ${SLATE_INDEX} — add these two lines by hand:`);
    console.log(`  ${importLine}`);
    console.log(`  ${arrayLine.trim()}   (in EPISODE_RECORDS)`);
  }
  console.log(
    record.lineStarts
      ? "It is playable: the guide will offer Play episode."
      : "The guide will list it as \"Not recorded yet\" until the audio build fills in " +
        "audio, lineStarts and dialogueEnd.",
  );
  console.log("Check it with: node scripts/lt-tv-check.mjs");
}

// Only run when invoked directly, so assemble/renderScript can be imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

