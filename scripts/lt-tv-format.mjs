// The LT TV news-show bible, in one place.
//
// Everything a script has to obey — who is on the set, which animation cues
// exist, how long a segment runs, how much text one ElevenLabs request can
// take — lives here rather than being restated in a prompt, a doc and a
// component. scripts/lt-news-script.mjs generates against it and validates
// against it; the audio build and the runtime read the same constants.

// ── The cast ──────────────────────────────────────────────────────────────
//
// The set has exactly TWO seats. TalkShowScene's CHARACTER_CLIPS registers
// Demon_Empty (actor "Barron") and Monk_Empty (actor "Monk") and nothing else,
// so a news desk with a third voice is not producible on this set today.
//
// One character, five names, depending on which file you are in: the animation
// config calls him Barron, the production doc calls him Connor, the Python
// processor calls him john, the GLB calls him Demon_Empty, and old council logs
// call him H80Z. `actor` below is the only name the pipeline uses.
export const CAST = {
  Barron: {
    actor: "Barron",
    displayName: "Barron",
    voiceId: "IcFWazAaBzXNwLWpySgF",
    processorKey: "john", // process_dialogue.py SPEAKERS key → john-sitepal-balanced.wav
    clipKey: "barron", // the SitePal clip-name suffix
    role: "anchor",
  },
  Monk: {
    actor: "Monk",
    displayName: "Saint GR80",
    voiceId: "fATgBRI8wg5KkDFg8vBd",
    processorKey: "gr80", // → gr80-sitepal-balanced.wav
    clipKey: "gr80",
    role: "co-anchor",
  },
};

// ── SitePal clip names ────────────────────────────────────────────────────
//
// SitePal account 9308752 has ONE Audio Manager shared by every character, not
// one per character, so a clip name has to be unique across the whole account —
// "episode 02 barron" is not a safe name, and neither is anything a second show
// might also reach for.
//
// The convention is the one agreed for LT TV as a whole (see
// docs/lt-tv-episode-runbook.md): lttv_<show>_ep<NN>_<character>, following the
// shape of the existing Terminal Traders clips (case001_monk_q5). A split
// episode's later sections append _s2, _s3.
export const SHOW_CLIP_SLUGS = {
  roundtable: "rt",
  news: "news",
  morality: "mm",
};

/**
 * The exact name to give an upload in SitePal's Audio Manager.
 * Generated rather than invented per episode, so the name in the record and the
 * name in SitePal cannot drift — TalkShowScene resolves clips by name, and a
 * mismatch is a silent failure to speak.
 *
 * @param {string} show     — a key of SHOW_CLIP_SLUGS
 * @param {string|number} number — episode number, zero-padded to two digits
 * @param {string} actor    — "Barron" | "Monk"
 * @param {number} [section] — 1-based; omitted or 1 yields no suffix
 */
export function sitepalClipName(show, number, actor, section = 1) {
  const slug = SHOW_CLIP_SLUGS[show];
  if (!slug) throw new Error(`Unknown show "${show}" — expected one of ${Object.keys(SHOW_CLIP_SLUGS).join(", ")}.`);
  const clipKey = CAST[actor]?.clipKey;
  if (!clipKey) throw new Error(`Unknown actor "${actor}".`);
  const ep = String(number).padStart(2, "0");
  return `lttv_${slug}_ep${ep}_${clipKey}${section > 1 ? `_s${section}` : ""}`;
}

export const ACTORS = Object.keys(CAST);

// ── Animation cues ────────────────────────────────────────────────────────
//
// Mirrors CHARACTER_CLIPS and REACTION_DURATIONS in TalkShowScene.jsx. A cue
// naming a reaction its actor does not have will T-pose or no-op at runtime,
// so the generator refuses one rather than shipping it into an upload.
export const REACTIONS = {
  Barron: {
    headnod: 4.33,
    headnodSubtle: 4.33,
    headshakeDisappointment: 4.33,
    shrug: 4.33,
    mockCrying: 4.83,
    lookAround: 7.6,
  },
  Monk: {
    headnod: 4.33,
    headnodSubtle: 4.33,
    headshake: 4.33,
    headshakeDisappointment: 4.33,
    shrug: 4.33,
    prayCrosschest: 3.87,
    lookAround: 7.6,
  },
};

// ── The rundown ───────────────────────────────────────────────────────────
//
// A fixed skeleton is the point: the same six segments every week is what makes
// the show producible in an afternoon instead of designed from scratch. The word
// targets sum to about 895 words, which at ESTIMATED_WPM is roughly 6:10 — the
// middle of the 5–10 minute window, so a segment can run long without the
// episode falling out of it.
export const SEGMENTS = [
  {
    id: "cold-open",
    label: "Cold open",
    targetWords: 95,
    intent:
      "Barron welcomes the audience and previews the three stories in one breath. GR80 undercuts the preview in a line. Fast, no news yet.",
  },
  {
    id: "story-1",
    label: "Lead story",
    targetWords: 210,
    intent:
      "The week's biggest story. Barron states the fact with its number, GR80 reframes what the number actually measures, Barron pushes back, GR80 lands the button.",
  },
  {
    id: "story-2",
    label: "Second story",
    targetWords: 200,
    intent: "Same beat pattern, different register — usually infrastructure, adoption or a chain milestone.",
  },
  {
    id: "story-3",
    label: "Third story",
    targetWords: 185,
    intent:
      "The week's absurd one. This is the comedy slot: Barron enjoys it, GR80 finds the uncomfortable truth underneath it.",
  },
  {
    id: "gauge",
    label: "The gauge",
    targetWords: 135,
    intent:
      "Fear & Greed across the week (the arc, not the spot reading) plus one prediction-market line. Ends on GR80 turning a number into a moral.",
  },
  {
    id: "sign-off",
    label: "Sign-off",
    targetWords: 70,
    intent:
      "Barron recaps the three stories in one sentence. GR80 closes the ledger and states plainly that none of it was a recommendation. Recurring closer — keep the shape week to week.",
  },
];

// ── Recording blocks ──────────────────────────────────────────────────────
//
// ElevenLabs Text-to-Dialogue is reliable up to roughly 2,000 characters per
// request, which is about 90 seconds of this show — so a six-minute episode is
// FOUR requests, not one. Segments are grouped into blocks that each fall under
// the budget, and blocks are cut at segment boundaries because there is a
// natural beat there anyway.
//
// Each block is generated in context (never line by line: the whole reason the
// conversational timing works is that ElevenLabs hears the exchange), then the
// masters are concatenated in order into one pair of full-length tracks. One
// upload pair per episode, so the runtime still plays exactly one track per
// character, and a line's global start is its in-block start plus the summed
// duration of the blocks before it.
//
// Membership is packed per episode rather than fixed, because segment lengths
// drift week to week — a fixed grouping that fits in September quietly breaks
// the ceiling in October, and the failure shows up as a truncated generation
// rather than an error.

export const CHAR_BUDGET_PER_BLOCK = 1500; // target
export const CHAR_LIMIT_PER_BLOCK = 2000; // hard ceiling from the ElevenLabs doc

/**
 * Greedily pack segments, in running order, into recording blocks under the
 * character budget. Segments are never split: a block boundary is always a
 * segment boundary, because there is a natural beat there anyway.
 *
 * @param {{id: string, chars: number}[]} segments — in running order
 * @returns {{id: string, segments: string[]}[]}
 */
export function packBlocks(segments) {
  const blocks = [];
  let current = null;

  for (const segment of segments) {
    if (current && current.chars + segment.chars <= CHAR_BUDGET_PER_BLOCK) {
      current.segments.push(segment.id);
      current.chars += segment.chars;
    } else {
      current = { id: `block-${blocks.length + 1}`, segments: [segment.id], chars: segment.chars };
      blocks.push(current);
    }
  }

  return blocks.map(({ id, segments: ids }) => ({ id, segments: ids }));
}

// Spoken-word rate used to estimate runtime before any audio exists. These
// deliveries run slower than plain narration because of the bracketed pauses.
// Recalibrate from the first real render: actual duration ÷ actual word count.
export const ESTIMATED_WPM = 145;

export const RUNTIME_BOUNDS_SECONDS = { min: 300, max: 600 };

// ── Delivery tags ─────────────────────────────────────────────────────────
//
// From docs/talk-show-production.md, which records what has actually read well
// in these two voices. Event tags (that produce a sound) are kept separate from
// delivery tags (that only colour the reading) because an event must never land
// in the first instant of a turn — process_dialogue.py trims 120ms off every
// speaker handoff and would eat it.
export const DELIVERY_TAGS = {
  Barron: [
    "[confidently]",
    "[matter-of-factly]",
    "[suspiciously]",
    "[slightly offended]",
    "[horrified]",
    "[reluctantly]",
  ],
  Monk: ["[dryly]", "[patiently]", "[amused]", "[calmly]", "[with quiet disapproval]"],
};

export const EVENT_TAGS = [
  "[chuckles]",
  "[laughs softly]",
  "[starts laughing]",
  "[sighs]",
  "[exhales]",
  "[clears throat]",
];

// ── Helpers ───────────────────────────────────────────────────────────────

export function countWords(text) {
  // Bracketed tags are performance direction, not spoken words.
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function estimateSeconds(words) {
  return (words / ESTIMATED_WPM) * 60;
}

export function formatRuntime(seconds) {
  const total = Math.round(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function segmentById(id) {
  return SEGMENTS.find((s) => s.id === id) ?? null;
}
