#!/usr/bin/env node
// Turning written lines into an episode record — for either show.
//
// `assemble()` is where a pile of dialogue becomes a producible episode: it
// numbers every line across the whole show, counts the words, estimates the
// runtime, packs the recording blocks to fit an ElevenLabs request, looks up
// each animation cue's clip length, and validates the lot. `renderScript()` is
// the screenplay that comes out of it, which is both what a producer reads and
// what `lt-tv-edit.mjs` parses back.
//
// This lives apart from either generator because BOTH shows end here. The news
// show arrives with a rundown built from feeds; the roundtable arrives with a
// debate plan built from a theme. What they disagree about is carried in the
// show's `format` and nothing else — which is the point. Two copies of this
// logic would drift, and the drift would show up as one show quietly losing a
// validation the other still has.

import {
  CAST,
  ACTORS,
  REACTIONS,
  SHOW_FORMATS,
  showFormat,
  packBlocks,
  sitepalClipName,
  CHAR_BUDGET_PER_BLOCK,
  CHAR_LIMIT_PER_BLOCK,
  EVENT_TAGS,
  countWords,
  estimateSeconds,
  formatRuntime,
} from "./lt-tv-format.mjs";

// ── The ticker ────────────────────────────────────────────────────────────
//
// A newscast's crawl is not a summary of the segment you are watching. It is
// the rest of the day's news going past underneath it — which is exactly what
// the brief has plenty of and the show has no room for. So the ticker is built
// from two lists: the few items about tonight's stories, and the SIDEBAR, the
// headlines the rundown pass considered and did not cover.
//
// The sidebar is the only copy on screen that no segment reads aloud and no
// search pass confirmed, so it is held to the brief. An item that cannot be
// traced back to something the brief nominated is a claim from nowhere,
// crawling under a show whose whole editorial rule is that it verifies what it
// says. That is a warning rather than a drop, the same as an unverified story:
// the producer decides, because the check is a word-overlap heuristic and a
// heuristic should not silently delete a real headline.

const TICKER_DISCLAIMER = "NOTHING ON THIS TICKER IS A RECOMMENDATION";
const TICKER_MAX_CHARS = 80;
// TWO THRESHOLDS, BECAUSE THE TWO CHECKS COST DIFFERENT THINGS WHEN WRONG.
//
// Failing to trace an item to the brief only prints a warning, so it can
// afford to be loose: a paraphrase should still match and a false alarm costs
// a line of output. Calling an item a restatement DELETES it, so it has to be
// near-certain — "ECB holds its deposit rate" shares "holds" and "rate" with a
// story about the FOMC holding rates and is a different central bank on a
// different continent. A real restatement of tonight's lead overlaps almost
// completely; a near-miss headline from the same beat does not.
const TICKER_TRACEABLE = 0.6;
const TICKER_RESTATES = 0.8;

function significantWords(text) {
  return String(text).toLowerCase().match(/[a-z0-9]{4,}/g) || [];
}

/** What share of `text`'s distinctive words appear in `haystack` (lowercase). */
function wordOverlap(text, haystack) {
  const words = significantWords(text);
  if (!words.length) return 0;
  return words.filter((word) => haystack.includes(word)).length / words.length;
}

/**
 * The crawl under the show, and what a producer should know about it.
 *
 * @param rundown  the editorial pass's output (`ticker` and `sidebar`)
 * @param brief    the week's brief, if there is one — what the sidebar is
 *                 checked against. Without it the check is skipped rather
 *                 than failed, because a hand-written episode has no brief.
 */
export function buildTicker(rundown = {}, brief = null) {
  const warnings = [];
  const items = [];
  const seen = new Set();

  const add = (text) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
    if (!clean) return;
    // The disclaimer is appended below, once, by this function. A model that
    // wrote its own would otherwise put two of them on the crawl.
    if (/recommendation/i.test(clean)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (clean.length > TICKER_MAX_CHARS) {
      warnings.push(
        `Ticker item "${clean.slice(0, 40)}…" is ${clean.length} characters against an ${TICKER_MAX_CHARS} target — it will scroll for a long time.`,
      );
    }
    items.push(clean);
  };

  for (const item of rundown.ticker || []) add(item);

  const covered = (rundown.stories || [])
    .map((story) => `${story.headline || ""} ${story.fact || ""}`)
    .join(" ")
    .toLowerCase();
  const haystack = brief ? JSON.stringify(brief).toLowerCase() : null;

  for (const entry of rundown.sidebar || []) {
    const text = String((typeof entry === "string" ? entry : entry?.text) || "").trim();
    if (!text) continue;
    if (covered && wordOverlap(text, covered) >= TICKER_RESTATES) {
      warnings.push(
        `Ticker: "${text}" restates a story the episode covers — dropped, the crawl is for what is NOT in the show.`,
      );
      continue;
    }
    const source = String((typeof entry === "string" ? entry : entry?.source) || text);
    if (haystack && wordOverlap(source, haystack) < TICKER_TRACEABLE) {
      warnings.push(
        `Ticker: "${text}" cannot be traced back to the brief — confirm it or cut it before recording.`,
      );
    }
    add(text);
  }

  // Said once, by the code, on every episode. The crawl now carries headlines
  // nobody reads aloud, so the line is more load-bearing than it was when the
  // model happened to write it.
  items.push(TICKER_DISCLAIMER);
  return { items, warnings };
}

// ── Assembly ──────────────────────────────────────────────────────────────
//
// Turns the writer's segments into the episode record: global line numbering,
// recording blocks under the character budget, derived runtime, and a warning
// list. Assembly is deliberately local and deterministic — the model writes
// words, this code owns every number.

/**
 * Turn written lines into an episode record.
 *
 * Show-agnostic: `format` carries everything the two shows disagree about —
 * their segment skeletons, how long an episode may run, and whether there is a
 * chiron. Everything else here (the global line numbering, the word counts,
 * the block packing, every validation) is identical for both, which is the
 * reason this is one function and not two that drift apart.
 */
function assemble({
  rundown,
  segments,
  week,
  brief,
  number = 1,
  format = SHOW_FORMATS.news,
  // Which generator produced these words, and with which model. Facts about
  // the caller, so the caller states them rather than this module guessing.
  producedBy = { model: null, pipeline: null },
}) {
  const warnings = [];
  const bySegment = new Map(segments.map((s) => [s.id, s]));

  let n = 0;
  const outSegments = [];

  for (const spec of format.segments) {
    const written = bySegment.get(spec.id);
    if (!written || !(written.lines || []).length) {
      // The spot is skipped in a week with no ad copy — that is normal, not a gap.
      if (!format.optional.has(spec.id)) {
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
  if (seconds < format.runtime.min || seconds > format.runtime.max) {
    warnings.push(
      `Estimated runtime ${formatRuntime(seconds)} falls outside the ${formatRuntime(format.runtime.min)}–${formatRuntime(format.runtime.max)} window.`,
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

  const ticker = buildTicker(rundown, brief);
  warnings.push(...ticker.warnings);

  const padded = String(number).padStart(2, "0");

  return {
    // Both shows are named by number: <show>-<NN>, the same id the slate, the
    // studio and both SitePal uploads use. A news episode used to be named for
    // its week instead (news-2026-W39), and that one difference broke the
    // studio the first time a real week was written: the page listed it as
    // news-01, looked for news-01.txt, found nothing, and greyed out Record.
    // The week a news episode covers is still recorded, in `week`; it is just
    // not the file name.
    id: `${format.id}-${padded}`,
    show: format.id,
    ...(format.dated ? { week } : {}),
    number: padded,
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
    // Only the news show has a chiron. Emitting an empty one for the
    // roundtable would put a headline bar on a show that has never had one.
    ...(format.graphicsMode
      ? {
          graphics: {
            mode: format.graphicsMode,
            headline: rundown.headline,
            ticker: ticker.items,
          },
        }
      : {}),

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
          sitepalAudio: sitepalClipName(format.id, number, a),
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
      model: producedBy.model ?? null,
      generatedAt: new Date().toISOString(),
      pipeline: producedBy.pipeline ?? null,
    },
    warnings,
  };
}

/**
 * The episode as a screenplay — and as the thing a producer edits.
 *
 * This is the only view of an episode anyone actually reads, so it is also
 * where changes are made: `scripts/lt-tv-edit.mjs` parses this exact format
 * back into a record. That makes the layout load-bearing rather than
 * cosmetic, and it is why two things appear here that a pure printout would
 * not bother with.
 *
 * The `>` marker is `directAddress`, and it has to be on the page because it
 * cannot be recovered from anything else. It decides whether the listener
 * turns to face the speaker or the camera pulls back to the two-shot, and a
 * line that loses it does not fail — it just quietly plays to the room. It is
 * also a real editorial choice, so a producer should be able to see and change
 * who a line is aimed at.
 *
 * The bracketed segment id is there because lines are reassembled into
 * segments by id, and a label is a display string that may be reworded.
 */
export function renderScript(episode) {
  const show = showFormat(episode.show);
  const out = [
    `${show.title.toUpperCase()} — ${episode.title}`,
    // A news episode is identified by its week; a roundtable has none, so it
    // is dated instead. Neither is editable — both are recomputed on write.
    `${episode.week ?? episode.airDate}   ·   ${episode.slate.runtime} estimated   ·   ${episode.slate.words} words`,
    `episode: ${episode.id}`,
    "",
    // Only the news show has a chiron, so only it gets an editable line for one.
    ...(episode.graphics ? [`CHIRON: ${episode.graphics.headline}`, ""] : []),
    "# Edit this file, then apply it with:",
    `#     node scripts/lt-tv-edit.mjs ${episode.id}`,
    "#",
    "# Reword any line. Add lines, delete lines, reorder them — they renumber",
    "# themselves and the counts above are recomputed, so do not keep them",
    "# current by hand.",
    "#",
    "# The > before a speaker means the line is aimed at the other host, who",
    "# turns to face them. Without it the line is played to the room and the",
    "# camera pulls back to the two-shot. Bracketed words like [dryly] are",
    "# delivery directions ElevenLabs performs, and they are part of the line.",
    "# An indented (Monk headshake @ +0.4s) is an animation beat on the line",
    "# above it. Lines starting with # are ignored.",
    "#",
    "# Three marks change the recording without changing a word. Put one on",
    "# its own line, just above the line it acts on:",
    "#     # cut            a section boundary goes exactly here",
    "#     # pause 1.5s     hold for that long before the line below",
    "#     # take 2         record the line below again (a stray syllable,",
    "#                      a flat reading); costs that one line. # take 3 next.",
    "# A pause is real silence laid into the tracks, the same length every",
    "# time — ElevenLabs cannot do that itself. Every line is rendered on its",
    "# own, so a pause changes no reading and costs nothing to add or move.",
    "# For a beat that only needs to sound right rather than be a measured",
    "# length, [long pause] inside the line colours the delivery instead.",
    "# Applying edits rewrites this file and wipes all three marks, so mark",
    "# them once the words are settled.",
    "#",
    "# To have a line rewritten instead of writing it yourself, put a # note",
    "# under it saying what is wrong, then run:",
    `#     node scripts/lt-tv-rewrite.mjs ${episode.id}`,
    "# Start the note #! to also keep it as a standing rule for future",
    "# episodes, in docs/lt-tv-style-notes.md. If only one sentence of a",
    "# long line is wrong, break the line there and note it there.",
    "",
  ];
  for (const segment of episode.segments) {
    out.push(
      `── ${segment.label.toUpperCase()}  [${segment.id}] — ${segment.words} words, ~${Math.round(segment.estimatedSeconds)}s`,
      "",
    );
    for (const line of segment.lines) {
      const who = CAST[line.actor].displayName.toUpperCase().padEnd(10);
      const aim = line.directAddress ? "> " : "  ";
      out.push(`${String(line.n).padStart(3)}  ${aim}${who} ${line.text}`);
      for (const cue of line.cues) {
        out.push(`${" ".repeat(17)} (${cue.actor} ${cue.reaction} @ +${cue.offset}s)`);
      }
    }
    out.push("");
  }
  return out.join("\n");
}

export { assemble };
