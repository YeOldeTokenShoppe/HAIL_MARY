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
 * @returns [] for a record with no segments, or for a show with no chiron:
 *          the roundtable has never had one and should not grow one here.
 */
export function buildChapters(episode) {
  if (!episode?.graphics) return [];
  const segments = episode.segments || [];
  const rundown = episode.rundown || {};
  const stories = new Map((rundown.stories || []).map((s) => [s.slot, s]));

  // The running order, as the cold open and the sign-off show it: what the
  // episode is actually covering tonight, in order.
  const runningOrder = (rundown.stories || [])
    .map((s) => String(s.headline || "").trim())
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
      screen = {
        kicker,
        headline,
        // The story's one concrete fact, which is the thing a viewer would
        // want to see written down while it is read out loud.
        lines: [String(story.fact || "").trim()].filter(Boolean),
        note: "",
      };
    } else if (segment.id === "the-board") {
      kicker = fixed.kicker;
      headline = "The week in numbers";
      screen = {
        kicker,
        headline,
        lines: (rundown.board?.lines || []).map((l) => String(l).trim()).filter(Boolean),
        note: String(rundown.board?.market || "").trim(),
      };
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

    chapters.push({ line: first.n, segment: segment.id, kicker, headline, screen });
  }

  return chapters;
}
