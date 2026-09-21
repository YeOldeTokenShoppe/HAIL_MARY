#!/usr/bin/env node
// WHERE IS EVERY EPISODE, AND WHAT DO I RUN NEXT.
//
//   npm run lt                        # every episode, both shows
//   npm run lt -- roundtable-03       # one episode, in detail
//   npm run lt -- --html              # a page to keep open
//
// Given as `npm run` throughout because that starts in the repo root wherever
// it is invoked; `node scripts/lt-tv-status.mjs` works only from the root.
//
// Producing an episode touches four directories and leaves a different trace
// in each, so "how far along is this one" has been a question you answer by
// listing directories and remembering what the files mean. This answers it by
// reading them.
//
// IT REPORTS, IT NEVER INFERS. Every stage below is decided by a file that is
// either on disk or is not, and the episode's own contents — never by a note
// left behind by a previous run. A dashboard that remembers what it did is a
// dashboard that is wrong the first time you do something by hand, and doing
// things by hand is most of how this show gets made.
//
// The one thing it cannot see is SitePal. The Audio Manager lives outside the
// repo, so "uploaded" is inferred from the record naming its clips, and the
// dashboard says as much rather than implying it checked.

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { sectionsForRecord } from "./lt-tv-sections.mjs";

import { SHOW_FORMATS, formatRuntime } from "./lt-tv-format.mjs";
import { SLATE_DIR, SLATE_INDEX } from "./lt-tv-slate-record.mjs";
import { arg, rejectUnknownFlags } from "./lt-tv-cli.mjs";

const STAGING_DIR = "content/lt-tv/episodes";
const AUDIO_DIR = "content/lt-tv/audio";
const SAMPLE_DIR = "content/lt-tv/samples";
const PLAN_DIR = "content/lt-tv/plans";

const KNOWN_FLAGS = ["html", "out"];

// The pipeline in order. An episode is at the last stage it has reached.
export const STAGES = [
  { id: "planned", label: "Planned", blurb: "named on the slate, no script yet" },
  { id: "written", label: "Written", blurb: "has a script, nothing recorded" },
  { id: "recorded", label: "Recorded", blurb: "audio built, not yet on the slate" },
  { id: "on-air", label: "On air", blurb: "playable in the guide" },
];

/**
 * The repo root, found by walking up from wherever this was run.
 *
 * A dashboard is the one script you reach for from inside whatever directory
 * you happen to be in, so requiring the repo root would make it wrong exactly
 * when it is most useful — and wrong quietly, by reporting an empty slate
 * rather than an error.
 */
export function findRoot(from = process.cwd()) {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, SLATE_DIR))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(from); // not in the repo; report honestly
    dir = up;
  }
}

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

/**
 * The show ids the site's channel list carries, in its own order.
 *
 * Empty when there is no shows.json to read — a temporary repo in a test, or a
 * checkout mid-rename — and the caller then falls back to every known format,
 * which is the old behaviour and cannot hide anything.
 */
async function readChannelShows(root) {
  try {
    const file = await readJson(join(root, "src/content/lt-tv/shows.json"));
    return (file.shows || []).map((s) => s.id).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Every pitch on disk: pass 1, saved, whether or not it has been written yet.
 *
 * The show is read out of the file rather than off the id, because a pitch
 * named for its week says nothing about which show it belongs to. A file
 * written by an older run is the bare plan with no envelope, and falls back
 * to the id's prefix.
 */
async function readPitches(root) {
  const out = [];
  let files = [];
  try {
    files = (await readdir(join(root, PLAN_DIR))).filter((f) => f.endsWith(".json"));
  } catch {
    return out;
  }
  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    const data = (await readJson(join(root, PLAN_DIR, file))) ?? {};
    const plan = data.plan ?? data;
    out.push({
      id,
      show: data.show ?? id.replace(/-[^-]+$/, ""),
      week: data.week ?? null,
      title: plan.title ?? "(untitled)",
      summary: plan.summary ?? "",
      stories: (plan.stories || []).length,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Everything that is true about one episode, read from disk.
 *
 * `slate` is the committed record the site reads; `staging` is the working
 * copy the pipeline writes, which is gitignored and therefore local to
 * whoever last generated it. An episode can have either, or both, and which
 * ones exist is most of the answer.
 */
async function inspect(id, { root, slate, staging, registered }) {
  const files = [];
  const add = (path, what) => {
    if (existsSync(join(root, path))) files.push({ path, what });
  };

  add(join(SLATE_DIR, `${id}.json`), "the record the site reads");
  add(join(STAGING_DIR, `${id}.json`), "the working record");
  add(join(STAGING_DIR, `${id}.txt`), "the screenplay — read and edit this one");
  add(join(PLAN_DIR, `${id}.json`), "the pitch it was written from");
  add(join(PLAN_DIR, `${id}.txt`), "the pitch, as an outline");
  add(join(AUDIO_DIR, id, "master-dialogue.wav"), "the recorded master");
  add(join(AUDIO_DIR, id, "voice-segments.json"), "the line timings");
  for (const f of ["draft", "sample"]) {
    add(join(SAMPLE_DIR, `${id}.${f}.json`), `a worked ${f}, not a scheduled episode`);
  }

  const playable =
    Boolean(slate?.audio && Object.keys(slate.audio).length) &&
    Array.isArray(slate?.lineStarts) &&
    slate.lineStarts.length > 0;
  const recorded = Array.isArray(staging?.timing?.lineStarts) && staging.timing.lineStarts.length > 0;
  const written =
    Boolean(staging?.segments?.length) ||
    Boolean(slate?.speakers?.length);

  let stage = "planned";
  if (written) stage = "written";
  if (recorded) stage = "recorded";
  if (playable) stage = "on-air";

  const lines =
    staging?.segments?.reduce((n, s) => n + s.lines.length, 0) ?? slate?.speakers?.length ?? 0;

  return {
    id,
    // A pitch is pass 1 saved: what the episode is going to be, before any of
    // it is written. It outlives the writing, so it is here at every stage —
    // an episode on air still answers "why did we cover that".
    pitch: existsSync(join(root, PLAN_DIR, `${id}.json`)),
    // Whether the guide has a record of its own for this id. It is what tells
    // a leftover working copy apart from an episode: a leftover has a
    // screenplay and audio and nothing the site reads.
    slated: Boolean(slate),
    show: slate?.showId ?? staging?.show ?? null,
    number: slate?.number ?? staging?.number ?? null,
    title: slate?.title ?? staging?.title ?? "(untitled)",
    summary: slate?.summary ?? staging?.summary ?? "",
    stage,
    lines,
    // Same derivation the guide uses: a playable record's runtime is the end
    // of the dialogue it carries, not a number anyone typed. Reading
    // `runtime` alone would show nothing for every episode recorded so far.
    runtime: playable
      ? slate.runtime || formatRuntime(slate.dialogueEnd)
      : (slate?.estimatedRuntime ?? staging?.slate?.runtime ?? null),
    runtimeIsEstimate: !playable,
    registered,
    // Every clip the episode asks SitePal for, sections included. An episode
    // over 90 seconds goes up as several per character (SitePal's own limit),
    // and listing only the first would have you upload two files out of eight.
    clips: clipNames(staging, slate),
    warnings: staging?.warnings ?? [],
    files,
    // `hasWorkingCopy` is passed rather than re-checked, because the check
    // has to be made against the root this run was given — an earlier version
    // resolved it against the process's own directory, which is right only
    // when you happen to run this from the repo root.
    next: nextStep({
      id,
      stage,
      registered,
      slate,
      staging,
      hasWorkingCopy: existsSync(join(root, STAGING_DIR, `${id}.json`)),
    }),
  };
}

/**
 * The one command to run next, and why.
 *
 * Deliberately one, not a list: the value of this whole thing is not having to
 * decide which of six commands applies.
 *
 * Given in its `npm run` form, because that is the one that works. `npm run`
 * starts in the repo root wherever it is invoked, while `node scripts/...` is
 * relative to whoever types it — and a dashboard exists to be read from
 * whatever directory you are already standing in.
 */
/** Every SitePal clip name an episode needs, in playing order. */
function clipNames(staging, slate) {
  if (Array.isArray(slate?.sections) && slate.sections.length) {
    return slate.sections.flatMap((section) => Object.values(section.audio ?? {}));
  }
  const cut = staging?.timing?.sections;
  if (staging?.cast && Array.isArray(cut) && cut.length > 1) {
    return sectionsForRecord(staging, cut).flatMap((s) => Object.values(s.audio));
  }
  if (staging?.cast) return Object.values(staging.cast).map((c) => c.sitepalAudio);
  return slate?.audio ? Object.values(slate.audio) : [];
}

function nextStep({ id, stage, registered, slate, staging, hasWorkingCopy }) {
  if (stage === "on-air") {
    if (!registered) {
      return {
        why: "it is playable but nothing imports it, so the guide will not show it",
        run: `add the import and the EPISODE_RECORDS entry in ${SLATE_INDEX}`,
      };
    }
    return { why: "nothing — it is playable in the guide", run: null };
  }

  if (stage === "recorded") {
    return {
      why: "the audio exists; the slate has not been told about it",
      run: `npm run lt:split -- ${id}`,
      then: `upload both WAVs under the clip names above, then npm run lt:slate -- ${id}`,
    };
  }

  if (stage === "written") {
    if (!hasWorkingCopy) {
      return {
        why: "the slate has this episode's script, but there is no working copy here to record from",
        run: `it was written on another machine, or the staging copy was cleaned up — re-run the script step for ${id}`,
      };
    }
    return {
      why: "it has a script and no audio",
      run: `npm run lt:audio -- ${STAGING_DIR}/${id}.json`,
      then: `read ${STAGING_DIR}/${id}.txt first, and apply any changes with npm run lt:edit -- ${id}`,
    };
  }

  const show = slate?.showId ?? staging?.show;
  return {
    why: "it is named on the slate and nobody has written it",
    // Every show but the news show is an argument show, written from its own
    // slate entry by lt:roundtable. Only the news show needs a brief pulled
    // first, so that is the branch worth naming — a new argument show added to
    // the slate gets the right advice without being listed here.
    run:
      show === "news"
        ? "npm run lt:brief, then npm run lt:news -- --brief <brief>"
        : `npm run lt:roundtable -- --topic ${id}`,
  };
}

/** Every episode either show knows about, slate and staging merged. */
export async function readStatus(root = process.cwd()) {
  const slate = new Map();
  try {
    for (const f of await readdir(join(root, SLATE_DIR))) {
      if (f.endsWith(".json")) slate.set(f.replace(/\.json$/, ""), await readJson(join(root, SLATE_DIR, f)));
    }
  } catch { /* no slate yet */ }

  const staging = new Map();
  try {
    for (const f of await readdir(join(root, STAGING_DIR))) {
      if (!f.endsWith(".json")) continue;
      // A writers'-room transcript written here before rooms had a directory
      // of their own. It is a conversation, not an episode, and it was listed
      // as one called "morality-02.room" under no show.
      if (f.endsWith(".room.json")) continue;
      // Named by id, the same id the slate uses, so the file name is the key.
      // It used to be derived from show + number so that a week-named news
      // record (news-2026-W39) could pair with its slate entry; that pairing
      // hid the fact that no step could find the file. Deriving it here would
      // also let a stale week-named copy shadow the real one.
      staging.set(f.replace(/\.json$/, ""), await readJson(join(root, STAGING_DIR, f)));
    }
  } catch { /* nothing generated here */ }

  let index = "";
  try {
    index = await readFile(join(root, SLATE_INDEX), "utf8");
  } catch { /* no index */ }

  const ids = [...new Set([...slate.keys(), ...staging.keys()])].sort();
  const episodes = await Promise.all(
    ids.map((id) =>
      inspect(id, {
        root,
        slate: slate.get(id),
        staging: staging.get(id),
        registered: index.includes(`./episodes/${id}.json`),
      }),
    ),
  );

  // THE CHANNEL LIST DECIDES WHAT IS A SHOW, not the format table. They are
  // not the same thing: a format is the shape of an episode, and more than one
  // show can share one. When The Liminal Terminal came off the channel list
  // its format stayed (Markets & Morality is that format), and listing every
  // format here printed a show with nothing on it that nobody could reach.
  //
  // A format that is off the list but still holds episodes is listed anyway —
  // otherwise leaving a channel would hide the very records that need moving.
  const channel = await readChannelShows(root);
  const listed = channel.length ? channel : Object.keys(SHOW_FORMATS);
  const order = [...listed, ...Object.keys(SHOW_FORMATS).filter((id) => !listed.includes(id))];
  // A PITCH THAT IS NOT AN EPISODE YET. The news show pitches a WEEK
  // (news-2026-W39) and only takes an episode number when it is written, so
  // its pitch has nowhere to hang until then. It belongs under the show.
  const loose = (await readPitches(root)).filter((p) => !episodes.some((e) => e.id === p.id));

  const shows = order
    .filter((id) => SHOW_FORMATS[id])
    .map((id) => ({
      id,
      title: SHOW_FORMATS[id].title,
      episodes: episodes.filter((e) => e.show === id),
      pitches: loose.filter((p) => p.show === id),
    }))
    .filter((show) => listed.includes(show.id) || show.episodes.length > 0 || show.pitches.length > 0);
  const orphans = episodes.filter((e) => !SHOW_FORMATS[e.show]);

  // A SHOW THAT IS OFF THE CHANNEL LIST IS NOT A SHOW. It used to keep its own
  // heading here for as long as it still held episodes, so that leaving a
  // channel could not hide the records that needed moving — but a heading is
  // how this page says "this is a programme", and The Liminal Terminal went on
  // looking like one months after it stopped being one (Michelle,
  // 2026-09-21). The records still cannot hide: they move in with the other
  // episodes that are not on the guide, which says exactly that about them.
  const off = shows.filter((s) => !listed.includes(s.id));
  const stranded = off.flatMap((s) => s.episodes.map((e) => ({ ...e, strandedFrom: SHOW_FORMATS[s.id].title })));

  // Where each stray belongs, worked out once and carried by BOTH lists. The
  // runner looks an episode up in `episodes` to build the rename, and a
  // `rehome` that existed only on the orphan copy would be missing exactly
  // where it is acted on.
  const rehomes = new Map([...orphans, ...stranded].map((e) => [e.id, rehomeFor(e, episodes, listed)]));
  const withRehome = (e) => (rehomes.has(e.id) ? { ...e, rehome: rehomes.get(e.id) } : e);

  return {
    shows: shows.filter((s) => listed.includes(s.id)),
    orphans: [...orphans, ...stranded].map(withRehome),
    episodes: episodes.map(withRehome),
  };
}

/**
 * Where a stray working copy belongs, when that can be said without guessing.
 *
 * An episode that changes show or number changes its ID, and the id is the
 * path — but only the committed record moves, because everything under
 * content/ is gitignored and lives on one machine. So The Wealth Effect is on
 * the guide as morality-01 while a working copy of the same episode sits there
 * as roundtable-02, and the studio, reading both, shows the title twice.
 *
 * The title is what links them, and it is only trustworthy when it is
 * unambiguous: this answers only when the stray has no record of its own and
 * exactly ONE episode on the guide is called the same thing. Two matches, or a
 * stray that is on the guide in its own right, get no answer rather than a
 * confident wrong one — renaming moves a recording on somebody's disk.
 */
function rehomeFor(stray, episodes, listed) {
  if (stray.slated) return null;
  const name = String(stray.title || "").trim().toLowerCase();
  if (!name || name === "(untitled)") return null;

  const twins = episodes.filter(
    (e) => e.id !== stray.id && e.slated && listed.includes(e.show) && String(e.title || "").trim().toLowerCase() === name,
  );
  return twins.length === 1 ? twins[0].id : null;
}

// ── the terminal view ─────────────────────────────────────────────────────

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[36m${s}\x1b[0m`,
  grey: (s) => `\x1b[90m${s}\x1b[0m`,
};

const STAGE_MARK = {
  planned: C.grey("○ planned "),
  written: C.yellow("◐ written "),
  recorded: C.blue("◕ recorded"),
  "on-air": C.green("● on air  "),
};

function printOne(e) {
  console.log(`\n${C.bold(e.title)}  ${C.dim(e.id)}`);
  if (e.summary) console.log(C.dim(`  ${e.summary}`));
  console.log(
    `  ${STAGE_MARK[e.stage].trim()}` +
      (e.lines ? C.dim(`  ·  ${e.lines} lines`) : "") +
      (e.runtime ? C.dim(`  ·  ${e.runtime}${e.runtimeIsEstimate ? " estimated" : ""}`) : ""),
  );

  if (e.files.length) {
    console.log("\n  Files:");
    for (const f of e.files) console.log(`    ${f.path}\n      ${C.dim(f.what)}`);
  } else {
    console.log(C.dim("\n  No files for this episode yet."));
  }

  if (e.clips.length) {
    console.log(`\n  SitePal clip names ${C.dim("(this cannot check the Audio Manager)")}:`);
    for (const c of e.clips) console.log(`    ${c}`);
  }

  if (e.warnings.length) {
    console.log(`\n  ${C.yellow(`${e.warnings.length} warning(s) from the script step:`)}`);
    for (const w of e.warnings) console.log(C.dim(`    · ${w}`));
  }

  console.log(`\n  Next: ${e.next.why}`);
  if (e.next.run) console.log(`    ${C.bold(e.next.run)}`);
  if (e.next.then) console.log(C.dim(`    then ${e.next.then}`));
}

function printAll({ shows, orphans }) {
  for (const show of shows) {
    console.log(`\n${C.bold(show.title)} ${C.dim(`(${show.id})`)}`);
    // A pitch with no episode yet is the next thing that happens on this show,
    // so it goes above the episodes rather than under them.
    for (const p of show.pitches ?? []) {
      console.log(`  ${C.yellow("◇ pitched ")}  ${C.dim(p.id.padEnd(15))} ${p.title}${C.dim("  not written yet")}`);
    }
    if (!show.episodes.length) {
      console.log(C.dim("  nothing on the slate yet"));
      continue;
    }
    for (const e of show.episodes) {
      const title = e.title.length > 26 ? `${e.title.slice(0, 25)}…` : e.title.padEnd(26);
      console.log(
        `  ${STAGE_MARK[e.stage]}  ${C.dim(e.id.padEnd(15))} ${title}` +
          C.dim(e.runtime ? `  ${e.runtime}${e.runtimeIsEstimate ? "~" : " "}` : "        "),
      );
    }
  }

  if (orphans.length) {
    console.log(`\n${C.yellow("Not attached to any show")}`);
    for (const e of orphans) {
      const why = e.strandedFrom ? C.dim(`  — filed under ${e.strandedFrom}, which is not on the guide`) : "";
      console.log(`  ${C.dim(e.id.padEnd(15))} ${e.title}${why}`);
      // The same episode under two names is the one case here that is worth
      // acting on rather than reading past, so it gets the command.
      if (e.rehome) {
        console.log(
          C.dim(`                  the guide already has this one as ${e.rehome} — `) +
            `npm run lt:rename -- ${e.id} ${e.rehome}`,
        );
      }
    }
  }

  // What to do next, for the whole slate rather than one episode: the earliest
  // unfinished episode is almost always the one you meant.
  const next = [...shows.flatMap((s) => s.episodes)]
    .filter((e) => e.next.run)
    .sort((a, b) => STAGES.findIndex((s) => s.id === b.stage) - STAGES.findIndex((s) => s.id === a.stage))[0];
  if (next) {
    console.log(`\n${C.dim("Closest to done:")} ${C.bold(next.title)} — ${next.next.why}`);
    console.log(`  ${next.next.run}`);
  }
  console.log(C.dim(`\nOne episode in detail:  npm run lt -- <id>`));
  console.log(C.dim(`A page to keep open:    npm run lt -- --html\n`));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rejectUnknownFlags(KNOWN_FLAGS);
  const status = await readStatus(findRoot());
  const wanted = process.argv.slice(2).find((a) => !a.startsWith("--"));

  if (wanted) {
    const episode = status.episodes.find((e) => e.id === wanted);
    if (!episode) {
      console.error(`No episode "${wanted}". Known: ${status.episodes.map((e) => e.id).join(", ")}`);
      process.exit(1);
    }
    printOne(episode);
    console.log("");
  } else if (arg("html")) {
    const { writeStatusPage } = await import("./lt-tv-status-page.mjs");
    const out = arg("out");
    const path = await writeStatusPage(status, typeof out === "string" ? out : undefined);
    console.log(`Wrote ${path}`);
    console.log("Open it in a browser. It is a snapshot — re-run this to refresh it.");
  } else {
    printAll(status);
  }
}
