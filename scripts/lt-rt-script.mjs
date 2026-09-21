#!/usr/bin/env node
//
// lt-rt-script — the script step for "The Liminal Terminal", the roundtable.
//
//   node scripts/lt-rt-script.mjs --topic roundtable-03
//   node scripts/lt-rt-script.mjs --theme "what a bailout actually buys"
//   node scripts/lt-rt-script.mjs --list          # what is on the slate, unwritten
//
// It writes BOTH argument shows: "The Liminal Terminal" and "Markets &
// Morality". They are the same format — two seats, one argument, six segments
// — under different banners, so the show comes from the topic's own id
// (roundtable-03, morality-01) rather than from a second copy of this file.
// `--theme` has no id to read, so it takes `--show` (default roundtable).
//
// The news show starts from a week of market signal. The roundtable does not
// start from anything that happened — it is one argument about one idea, and
// its topics are themes rather than events. So there is no brief step here and
// nothing to verify against a feed: pass 1 turns a theme into a DEBATE PLAN,
// pass 2 writes the dialogue from it.
//
// Everything after that is shared with the news show. The record it writes has
// the same shape, so `lt-tv-edit.mjs` edits it, `lt-tv-audio.mjs` records it
// and `lt-tv-slate-record.mjs` puts it on the guide, all unchanged.
//
// WHY THERE IS NO SOURCING PASS. The news show searches the web because it
// reads numbers out loud and a wrong number spoken in a character's voice is
// expensive to undo. This show is about ideas, so the prompt forbids stating
// statistics as fact outright. That is a cheaper guarantee than verification
// and a stronger one: there is nothing to get wrong.
//
// Env: ANTHROPIC_API_KEY (required unless --draft)
//      LT_TV_MODEL       (default claude-opus-5)

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  ACTORS,
  REACTIONS,
  DELIVERY_TAGS,
  EVENT_TAGS,
  showFormat,
  TITLE_RULES,
} from "./lt-tv-format.mjs";
import { assemble, renderScript } from "./lt-tv-episode.mjs";
import { arg, rejectUnknownFlags } from "./lt-tv-cli.mjs";
import { claude as callClaude } from "./lt-tv-claude.mjs";
import { readStyleNotes, withStyleNotes } from "./lt-tv-style-notes.mjs";
import { toSlateRecord, writeSlateRecord, SLATE_DIR, SLATE_INDEX } from "./lt-tv-slate-record.mjs";

const MODEL = process.env.LT_TV_MODEL || "claude-opus-5";
const PIPELINE = "scripts/lt-rt-script.mjs";
// The shows this generator writes, in slate order. Both resolve through
// showFormat, so adding one here is adding it to SHOW_FORMATS and nothing else.
const SHOWS = ["roundtable", "morality"];
const DEFAULT_SHOW = "roundtable";
const EPISODE_DIR = "content/lt-tv/episodes";

const KNOWN_FLAGS = ["topic", "theme", "show", "list", "draft", "plan-only", "number", "out", "max-tokens", "slate", "no-slate", "retitle"];
const MAX_TOKENS = { plan: 6000, dialogue: 16000 };

const claude = (opts) => callClaude({ ...opts, model: MODEL });

// ── Pass 1: the argument ──────────────────────────────────────────────────

const PLAN_SYSTEM = `You are the producer of "The Liminal Terminal", a weekly animated roundtable broadcast from a neon devotional trading floor where cyborgs and degens pray over markets. Two hosts sit and argue about one idea for about six minutes. You are handed tonight's theme and you decide what the argument actually IS.

THE SHOW IS NOT A NEWS SHOW. Nothing happened this week. The subject is an idea about markets, money and what people do to each other with them — the psychology, the morality, the stories people tell to make a number feel like a virtue.

WHAT MAKES AN EPISODE WORK, and this is the whole job:
BOTH CHARACTERS ARE RIGHT ABOUT SOMETHING. Connor is not a fool who exists to be corrected and GR80 is not a scold who wins by default. If your plan walks from "Connor is wrong" to "GR80 explains why", you have produced a sermon and nobody wants to hear it twice. The audience should be able to argue for either side when it ends.

So you need FOUR things:
1. A QUESTION with a real choice in it — concrete, answerable, and uncomfortable. "If you could save humanity with a single trade, would you do it?" is the shape. "Let's discuss greed" is not.
2. Connor's HONEST CASE. The strongest version of the market's side, the one a thoughtful opponent would concede is fair. Not a strawman, not greed wearing a hat. It is made by a man who plays the market's side for a living and says so — an insider and a short-seller arguing from inside the trade, not a reformer arguing from outside it. If you cannot write it sincerely, pick a different question.
3. GR80's REFRAME. Not a contradiction — a shift of frame that names what the case quietly costs and who is not in the room to object. It should be something the audience had not put into words themselves.
4. A HARD CASE. One specific, concrete situation that is uncomfortable for BOTH of them: where Connor's principle produces something he does not like, AND GR80's produces something he cannot pay for. This is the segment that keeps the show honest, so it must genuinely cut both ways. If it only embarrasses one of them, it is not a hard case.

RULES:
- Invent no statistics, no studies, no dated events and no quotes. This show argues from reasoning and example, not evidence. A made-up number spoken in a character's voice is the one failure that is expensive to undo, so there are no numbers to make up.
- Named historical events in broad strokes are fine ("a bank failed and the state covered the depositors"); specific figures, dates and attributions are not.
- No financial advice of any kind, and nothing that reads as a recommendation.
- The concession must be real. Decide now which of them gives ground and on what, and make it cost him something.

${TITLE_RULES}
This show has no stories to name, so title it for the IDEA — "The Wealth Effect", "Why We Chase Tops" — and never for the question you wrote.

Return ONLY a JSON object, no preamble and no code fences:
{
  "title": "the episode title, written to the title rules above",
  "summary": "one sentence for the programme guide",
  "question": "the question Connor opens with, as he would say it",
  "flaw": "what GR80 immediately finds wrong with how it was asked, one sentence",
  "connorCase": "the honest market case, 2-3 sentences",
  "gr80Reframe": "the reframe and what it names, 2-3 sentences",
  "hardCase": "the specific situation that costs them both, 2-3 sentences",
  "concession": { "who": "Connor" | "Monk", "what": "what he gives up and what it costs him, one sentence" },
  "landing": "the one sentence GR80 closes on, as he would say it"
}`;

// ── Pass 2: the dialogue ──────────────────────────────────────────────────

const SCRIPT_SYSTEM = `You are the writer of "The Liminal Terminal", a six-minute animated roundtable broadcast from a neon devotional trading floor. Two characters sit in two chairs and argue about one idea. You write the whole episode as spoken dialogue.

THE TWO HOSTS — this is the whole show, so get them exactly right:

CONNOR (the host). The devil's advocate, and he knows it. An inside trader and a short-seller who has watched a thousand pump-and-dumps and enjoyed every one, and who is completely honest about who he is: he argues the market's side because he IS the market's side, and he would rather say so than pretend otherwise. Loud, smug, market-brained, entertained by his own takes. Short staccato sentences. He distrusts velocity — "loud means cheap" — and respects silence. He is funny, and he is a good sparring partner: he enjoys GR80, wants the fight, and never gets wounded by it. He is not detestable and he is not a villain — the audience should like him — but he is NOT sweet, and he is NOT empathetic. Warmth from Connor comes out as a joke, a bet, or a grudging compliment, never as sympathy or a soft speech about people. He is never earnest for more than one line at a time, and when GR80 lands a point on him he concedes it grudgingly and immediately changes the subject. He is genuinely clever: his case is the one a smart person would make, not a caricature of greed.

SAINT GR80 (the co-host). An android monk, keeper of logs. Measured, austere, procedural, with occasional liturgical phrasing. He answers a claim with what the claim actually costs. He is dry rather than funny, and his jokes arrive flat and land late. He is never cruel and NEVER preachy — he makes one observation and stops. He does not moralize at the audience; he moralizes at Connor, who deserves it.

THE ARGUMENT IS THE SHOW. Both of them are right about something. Connor's case must be genuinely strong; GR80's reframe must genuinely land. In the hard case NEITHER of them gets a clean win, and the concession is partial and costs the one who makes it. A listener should be able to argue either side afterwards.

HARD RULES:
- Invent no statistics, no studies, no dated events, no quotes and no attributions. This show argues from reasoning and example. If you want a number, write the line without it.
- No financial advice, ever: no buys, sells, entries, exits, allocations, or price targets. The characters may mock the asking.
- Each line is ONE character speaking aloud, 1 to 3 sentences. No markdown, no stage directions outside the bracket tags below, no speaker labels inside the text.
- Alternate speakers. Never give the same host two turns in a row — the camera cuts on who is speaking, so a double turn holds on one face while the other sits idle. If a host needs two thoughts, put them in one line.
- Never say "as an AI", never mention a model, never break the frame.
- Write any number as it is spoken: "a hundred dollars", not "$100". The voice model reads the text literally.

DELIVERY TAGS: put at most one bracketed delivery tag at the START of a line, and only when the reading is not obvious. Connor may use: ${DELIVERY_TAGS.Connor.join(", ")}. GR80 may use: ${DELIVERY_TAGS.Monk.join(", ")}. Roughly half of all lines should carry NO tag — a tag on every line flattens the performance.

EVENT TAGS (these produce an actual sound): ${EVENT_TAGS.join(", ")}. Use at most two in the whole episode, and NEVER as the first thing in a line — the audio pipeline trims the first 120 milliseconds of every speaker handoff and would eat it. Put an event after a few words.

DIRECT ADDRESS: set "directAddress": true on a line when the speaker is talking AT the other host rather than to the audience — the listener turns their head to face them. This show is mostly two people talking to each other, so direct address is the NORM here: roughly two thirds of lines. The exceptions are the opening address to the audience and the closing line.

ANIMATION CUES: attach reactions to lines to give the LISTENER something to do while the other talks. Each cue is { "actor": who performs it, "reaction": one of the names below, "offset": seconds after the line begins }. Connor can perform: ${Object.keys(REACTIONS.Connor).join(", ")}. GR80 can perform: ${Object.keys(REACTIONS.Monk).join(", ")}. Aim for one cue every four or five lines — the set is two people in chairs, so stillness reads as attention and constant motion reads as a screensaver. Use headnodSubtle for ordinary agreement and save headnod for an emphatic beat. lookAround is a long clip; use it at most twice.

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

function scriptUserMessage(plan, format) {
  const skeleton = format.segments
    .map((s) => `- ${s.id} ("${s.label}"), target ${s.targetWords} spoken words. ${s.intent}`)
    .join("\n");

  const target = format.segments.reduce((n, s) => n + s.targetWords, 0);

  return `TONIGHT'S ARGUMENT
${JSON.stringify(plan, null, 2)}

THE SEGMENTS, in order — write all ${format.segments.length}:
${skeleton}

Hit the word targets within about fifteen percent. They add up to roughly ${target} spoken words, and the episode has to land between four and nine minutes.`;
}

// ── Where a topic comes from ──────────────────────────────────────────────

/**
 * Which show a slate record belongs to. The record says so; the id prefix is
 * the fallback for a hand-written entry that forgot the field.
 */
function showId(record, id) {
  const show = record.showId || String(id).replace(/-\d+$/, "");
  if (!SHOWS.includes(show)) {
    throw new Error(
      `"${id}" belongs to the "${show}" show, which this pipeline does not write.\n` +
        `It writes ${SHOWS.join(" and ")}. A news episode starts from npm run lt:brief.`,
    );
  }
  return show;
}

/** Does this slate file belong to one of the shows this generator writes? */
const belongsHere = (file) =>
  SHOWS.some((show) => new RegExp(`^${show}-\\d+\\.json$`).test(file));

/**
 * Slate episodes of these shows that have a title but no script yet.
 *
 * The slate is the running order of the show, and five of its episodes were
 * named long before there was any way to write one. They are the topic queue,
 * so the generator reads them rather than asking for a theme that already
 * exists in the repo. Both argument shows queue here, because both are written
 * by this pipeline.
 */
export async function unwrittenTopics(root = process.cwd()) {
  let files = [];
  try {
    files = (await readdir(join(root, SLATE_DIR))).filter(belongsHere);
  } catch {
    return [];
  }
  const records = await Promise.all(
    files.sort().map(async (f) => JSON.parse(await readFile(join(root, SLATE_DIR, f), "utf8"))),
  );
  return records.filter((r) => !Array.isArray(r.lineStarts) || !r.lineStarts.length);
}

async function resolveTopic() {
  const topic = arg("topic");
  const theme = arg("theme");

  if (topic && topic !== true) {
    const path = resolve(SLATE_DIR, `${topic}.json`);
    let record;
    try {
      record = JSON.parse(await readFile(path, "utf8"));
    } catch {
      throw new Error(`No episode "${topic}" on the slate. Try --list to see what is there.`);
    }
    if (Array.isArray(record.lineStarts) && record.lineStarts.length) {
      throw new Error(
        `${topic} is already recorded. Writing a new script for it would leave the audio\n` +
          "saying something the record no longer claims. Pick another topic, or edit the\n" +
          "script you have with scripts/lt-tv-edit.mjs.",
      );
    }
    return {
      // THE SHOW COMES FROM THE RECORD, never from this file. Both argument
      // shows are written here, and assuming "roundtable" would have written
      // morality-01's script out as roundtable-01 — over The Halo Effect.
      show: showId(record, topic),
      number: Number(record.number),
      theme: `${record.title} — ${record.summary}`,
      // Michelle named these episodes. The model is writing the argument, not
      // renaming the show's running order, so the slate's title and summary
      // win unless --retitle says otherwise.
      keep: arg("retitle") ? null : { title: record.title, summary: record.summary },
      from: topic,
    };
  }

  if (theme && theme !== true) {
    // A theme is not on the slate, so there is no record to read the show off.
    const show = arg("show");
    const chosen = show && show !== true ? show : DEFAULT_SHOW;
    if (!SHOWS.includes(chosen)) {
      throw new Error(`--show expects one of ${SHOWS.join(", ")}, got "${chosen}".`);
    }
    return { show: chosen, number: await nextNumber(chosen), theme, keep: null, from: null };
  }

  throw new Error(
    "Give it a topic: --topic roundtable-03 (one already on the slate), or\n" +
      "--theme \"the idea you want them to argue about\" (add --show morality for\n" +
      "Markets & Morality). --list shows what is waiting.",
  );
}

async function nextNumber(show) {
  const flag = arg("number");
  if (flag && flag !== true) {
    const n = Number(flag);
    if (!Number.isInteger(n) || n < 1) throw new Error(`--number expects a whole number from 1, got "${flag}".`);
    return n;
  }
  try {
    const pattern = new RegExp(`^${show}-\\d+\\.json$`);
    const files = (await readdir(resolve(SLATE_DIR))).filter((f) => pattern.test(f));
    return files.length + 1;
  } catch {
    return 1;
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  rejectUnknownFlags(KNOWN_FLAGS);

  if (arg("list")) {
    const waiting = await unwrittenTopics();
    if (!waiting.length) {
      console.log("Every episode on the slate for these shows has a script.");
      return;
    }
    console.log(`${waiting.length} episode(s) on the slate with no script yet:\n`);
    for (const r of waiting) console.log(`  ${r.id}  ${r.title}\n            ${r.summary}`);
    console.log(`\nWrite one with: node ${PIPELINE} --topic ${waiting[0].id}`);
    return;
  }

  const draftPath = arg("draft");
  let plan;
  let segments;
  let topic;

  if (draftPath && draftPath !== true) {
    // A hand-written or hand-edited plan, assembled without calling the model.
    const draft = JSON.parse(await readFile(resolve(draftPath), "utf8"));
    ({ plan, segments } = draft);
    topic = draft.topic ?? { show: DEFAULT_SHOW, number: await nextNumber(DEFAULT_SHOW), keep: null, from: null };
    topic.show ??= DEFAULT_SHOW;
  } else {
    topic = await resolveTopic();
    // Standing corrections from docs/lt-tv-style-notes.md. Read once and sent
    // with both passes, so a rule about how these two talk shapes the argument
    // as well as the dialogue.
    const houseNotes = await readStyleNotes();
    if (houseNotes.length) console.log(`House notes: ${houseNotes.length} in force.`);
    console.log(`Argument pass (${MODEL})…`);
    plan = await claude({
      system: withStyleNotes(PLAN_SYSTEM, houseNotes),
      user: `TONIGHT'S THEME\n${topic.theme}\n\nWrite the argument.`,
      maxTokens: MAX_TOKENS.plan,
    });
    console.log(`  "${plan.title}" — ${plan.question}`);
    console.log(`  ${plan.concession.who} concedes: ${plan.concession.what}`);

    if (arg("plan-only")) {
      const out = arg("out");
      const path = typeof out === "string" ? out : `content/lt-tv/plans/${topic.show}-${String(topic.number).padStart(2, "0")}.json`;
      await mkdir(dirname(resolve(path)), { recursive: true });
      await writeFile(resolve(path), JSON.stringify(plan, null, 2) + "\n");
      console.log(`Wrote ${path}`);
      return;
    }

    console.log("Dialogue pass…");
    ({ segments } = await claude({
      system: withStyleNotes(SCRIPT_SYSTEM, houseNotes),
      user: scriptUserMessage(plan, showFormat(topic.show)),
      maxTokens: MAX_TOKENS.dialogue,
    }));
  }

  const episode = assemble({
    rundown: {
      ...plan,
      title: topic.keep?.title ?? plan.title,
      summary: topic.keep?.summary ?? plan.summary,
    },
    segments,
    number: topic.number,
    format: showFormat(topic.show),
    producedBy: { model: draftPath ? null : MODEL, pipeline: PIPELINE },
  });

  const jsonPath = resolve(EPISODE_DIR, `${episode.id}.json`);
  const txtPath = jsonPath.replace(/\.json$/, ".txt");
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(episode, null, 2) + "\n");
  await writeFile(txtPath, renderScript(episode) + "\n");

  const lineCount = episode.segments.reduce((n, s) => n + s.lines.length, 0);
  console.log(
    `\n${episode.title} — ${episode.slate.runtime}, ${episode.slate.words} words, ${lineCount} lines`,
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

  if (!arg("no-slate")) {
    const { path, registered, importLine, arrayLine } = await writeSlateRecord(toSlateRecord(episode));
    console.log(`Wrote ${path}`);
    if (!registered) {
      console.log(`Could NOT register it in ${SLATE_INDEX} — add these two lines by hand:`);
      console.log(`  ${importLine}`);
      console.log(`  ${arrayLine.trim()}   (in EPISODE_RECORDS)`);
    }
  }

  console.log("\nRead it, fix it, and apply your edits with:");
  console.log(`  node scripts/lt-tv-edit.mjs ${episode.id}`);
  console.log("Then record it with:");
  console.log(`  node scripts/lt-tv-audio.mjs ${jsonPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
