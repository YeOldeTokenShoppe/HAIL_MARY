// WHAT IS ON SCREEN, AND WHEN — the episode's own running order, turned into
// on-air graphics.
//
// A newscast's lower third and its studio screen change as the show moves from
// story to story. Everything needed to do that is already written down by the
// time a script exists: `segments` says where each part of the show begins, and
// `rundown` says what that part is about. This module joins the two into a list
// of CHAPTERS, one per segment, each carrying the chiron copy and the card the
// set's `Content_Screen` should be showing while it runs.
//
// CHAPTERS ARE ANCHORED ON A LINE NUMBER, NEVER ON A SECOND, and that is the
// whole design. Absolute times come out of the audio build and are rewritten
// every time an episode is re-recorded or a line is re-rendered; a chapter
// holding `at: 128.4` would go quietly out of step with the show it labels, and
// a chiron naming the wrong story is the kind of fault you only find on air.
// A line number survives a re-record, so the graphics move with the audio for
// free. `buildEpisodeTimeline` resolves `line` through `lineStarts` at load
// time, exactly as it already does for the reaction cues.
//
// Pure and side-effect free, so both the staging step and its tests can call it.

// The beat a story was filed under, as a viewer would read it on a plate.
const BEAT_KICKERS = {
  macro: "Macro",
  markets: "Markets",
  crypto: "Crypto",
  collectibles: "Collectibles",
  predictions: "Prediction markets",
};

// Segments that are not a story: what their plate says, and whether the screen
// behind the hosts carries the episode's running order while they run.
const FIXED = {
  "cold-open": { kicker: "Tonight", rundownCard: true },
  "the-spot": { kicker: "The break", rundownCard: false },
  "the-board": { kicker: "The board", rundownCard: false },
  "sign-off": { kicker: "That was the week", rundownCard: true },
};

/** Title case for a beat we do not have a plate for. */
function titleCase(value) {
  const text = String(value || "").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/**
 * The chapters of an episode.
 *
 * @param episode  a production record as `assemble()` returns it — it needs
 *                 `segments` (with their lines) and `rundown`.
 * @param warn      told about any screen copy dropped by the number check.
 * @returns [] for a record with no segments, or for a show with no chiron:
 *          the roundtable has never had one and should not grow one here.
 */
export function buildChapters(episode, { warn = () => {} } = {}) {
  if (!episode?.graphics) return [];
  const segments = episode.segments || [];
  const rundown = episode.rundown || {};
  const stories = new Map((rundown.stories || []).map((s) => [s.slot, s]));

  // The running order, as the cold open and the sign-off show it: what the
  // episode is actually covering tonight, in order — in the short screen
  // headlines where the writer gave them, since this is a list on the studio
  // screen rather than a chiron.
  const runningOrder = (rundown.stories || [])
    .map((s) => String(s.screen?.headline || s.headline || "").trim())
    .filter(Boolean);

  const chapters = [];
  for (const segment of segments) {
    const first = (segment.lines || [])[0];
    if (!first || !Number.isInteger(first.n)) continue;

    const story = stories.get(segment.id);
    const fixed = FIXED[segment.id];

    let kicker;
    let headline;
    let screen;

    if (story) {
      kicker = BEAT_KICKERS[story.beat] || titleCase(story.beat) || "Story";
      headline = String(story.headline || "").trim() || episode.graphics.headline;
      screen = storyScreen(story, kicker, headline, warn);
    } else if (segment.id === "the-board") {
      kicker = fixed.kicker;
      headline = "The week in numbers";
      screen = boardScreen(rundown.board, kicker, headline, warn);
    } else {
      kicker = fixed?.kicker || segment.label || "";
      headline = String(episode.graphics.headline || episode.title || "").trim();
      screen = {
        kicker,
        headline,
        lines: fixed?.rundownCard ? runningOrder : [],
        note: "",
      };
    }

    // What the screen was built from, so a later re-stage can tell whether a
    // card written by hand still belongs to this story.
    const source = story ? String(story.headline || "").trim()
      : segment.id === "the-board" ? String(rundown.board?.lines?.[0] || "").trim()
      : fixed?.rundownCard ? (rundown.stories || []).map((s) => String(s.headline || "").trim()).join(" | ")
      : "";
    const authored = story ? Boolean(story.screen)
      : segment.id === "the-board" ? Boolean(rundown.board?.screen?.length)
      : (rundown.stories || []).some((s) => s.screen?.headline);
    // Built from the host copy rather than written for the screen, so a card
    // written by hand onto the slate record may replace it (keepScreenCopy).
    if (!authored) screen.derived = true;

    chapters.push({ line: first.n, segment: segment.id, kicker, headline, source, screen });
  }

  return chapters;
}

// ── The studio screen's own copy ──────────────────────────────────────────
//
// A story's "fact" is written to brief the hosts: one full sentence with every
// number in it. On the studio screen that read as a wire story set in type,
// and Michelle called it too dense (2026-09-24). So the writer now also gives
// each story a `screen` block made for a screen — a short headline, one big
// figure when the story has one, and two or three bullets of a few words —
// and the board a list of "label value" items. An episode written before
// that falls back to the old card.
//
// EVERY NUMBER ON THE SCREEN MUST ALREADY BE IN THE CHECKED COPY. The fact
// and the board were verified against a real article; screen copy is a
// shorter rewrite of them and is not re-verified. So a figure or bullet whose
// number is not in the story's fact (or the board's lines) is dropped here,
// rather than drawn behind the hosts as though it had been checked.

// Numbers as written, but not the digits inside a word like "2s10s". On the
// screen side a number hyphenated onto a word ("10-yr") is a label, not a
// figure; in the checked copy it is a figure ("a 72-year-old").
const NUMBER = /(?<![A-Za-z\d.])\d[\d,]*(?:\.\d+)?(?![A-Za-z\d])/g;
const LABEL_NUMBER = /-[A-Za-z]/;

function numbersIn(text, { labels = false } = {}) {
  const out = [];
  for (const match of String(text || "").matchAll(NUMBER)) {
    const after = String(text).slice(match.index + match[0].length, match.index + match[0].length + 2);
    if (labels && LABEL_NUMBER.test(after)) continue;
    out.push(match[0].replace(/,/g, "").replace(/\.$/, ""));
  }
  return out;
}

/** True when `shown` is `checked`, or `checked` rounded to as many places. */
function sameNumber(shown, checked) {
  if (shown === checked) return true;
  const places = (shown.split(".")[1] || "").length;
  const a = Number(shown);
  const b = Number(checked);
  return Number.isFinite(a) && Number.isFinite(b) && Number(b.toFixed(places)) === a;
}

/** Every number in `text` appears in `checked` (the copy that was verified). */
export function numbersChecked(text, checked) {
  const known = numbersIn(checked);
  return numbersIn(text, { labels: true }).every((n) => known.some((k) => sameNumber(n, k)));
}

const clean = (value) => String(value ?? "").trim();
const cleanList = (list) => (Array.isArray(list) ? list : []).map(clean).filter(Boolean);

function storyScreen(story, kicker, headline, warn) {
  const fact = clean(story.fact);
  const copy = story.screen && typeof story.screen === "object" ? story.screen : null;
  // No screen copy: the card this show aired with before it had any.
  if (!copy) return { kicker, headline, lines: fact ? [fact] : [], note: "" };

  // Keeps what passes the number check, and reports what does not.
  const passes = (what, text) => {
    if (numbersChecked(text, fact)) return true;
    warn(`${story.slot}: dropped the screen's ${what} "${text}" — it has a number the checked fact does not.`);
    return false;
  };
  let figure = clean(copy.figure);
  if (figure && !passes("figure", figure)) figure = "";
  const label = figure ? clean(copy.label) : "";
  const points = cleanList(copy.points)
    .filter((p) => passes("bullet", p))
    .slice(0, figure ? 1 : 3);

  if (!figure && !points.length) return { kicker, headline, lines: fact ? [fact] : [], note: "" };
  return {
    kicker,
    headline: clean(copy.headline) || headline,
    ...(figure ? { figure, label } : {}),
    lines: points,
    note: "",
  };
}

function boardScreen(board, kicker, headline, warn) {
  const lines = cleanList(board?.lines);
  const market = clean(board?.market);
  const items = cleanList(board?.screen);
  if (!items.length) return { kicker, headline, lines, note: market };

  const checked = [...lines, market].join(" \n ");
  const kept = items
    .filter((item) => {
      if (numbersChecked(item, checked)) return true;
      warn(`the board: dropped "${item}" from the screen — it has a number the checked board does not.`);
      return false;
    })
    .slice(0, 5);
  const note = clean(board?.screenNote);
  return {
    kicker,
    headline,
    lines: kept.length ? kept : lines,
    note: note && numbersChecked(note, checked) ? note : kept.length ? "" : market,
  };
}

/**
 * Keep screen copy the slate record already has, where the production record
 * has none of its own.
 *
 * news-01 was written before stories carried screen copy, and its production
 * record lives only on Michelle's machine, so its lighter cards were written
 * straight onto the slate record. Without this, re-staging would put the old
 * paragraph back. Only a DERIVED card is replaced, and only by one made from
 * the same story in the same segment: every news episode is staged as news-01,
 * and next week's story-1 must never inherit this week's card.
 *
 * @returns the new record's chapters, with kept cards swapped in.
 */
export function keepScreenCopy(chapters, previous) {
  if (!Array.isArray(chapters) || !Array.isArray(previous)) return chapters;
  return chapters.map((chapter) => {
    if (!chapter.screen?.derived || !chapter.source) return chapter;
    const before = previous.find(
      (c) => c.segment === chapter.segment && c.source === chapter.source && c.screen && !c.screen.derived,
    );
    return before ? { ...chapter, screen: { ...before.screen } } : chapter;
  });
}
