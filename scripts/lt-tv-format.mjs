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
// The character is CONNOR. He has picked up other names in other files over
// time — the animation config in TalkShowScene calls him Barron, the Python
// processor calls him john, the GLB node is Demon_Empty, and old council logs
// call him H80Z — but Connor is the name, and `actor` below is the only one
// this pipeline uses.
//
// NOTE: TalkShowScene's CHARACTER_CLIPS still maps `Demon_Empty` to the actor
// string "Barron", and process_dialogue.py's ACTOR_NAMES still maps `john` to
// "Barron". Those are shared files being renamed separately; until they are,
// anything joining this pipeline to the runtime has to bridge the two spellings.
export const CAST = {
  Connor: {
    actor: "Connor",
    displayName: "Connor",
    voiceId: "IcFWazAaBzXNwLWpySgF",
    processorKey: "john", // process_dialogue.py SPEAKERS key → john-sitepal-balanced.wav
    sceneActorKey: "Barron", // what TalkShowScene's CHARACTER_CLIPS calls him today
    clipKey: "connor", // the SitePal clip-name suffix
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
// "episode 02 connor" is not a safe name, and neither is anything a second show
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
 * @param {string} actor    — "Connor" | "Monk"
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
  Connor: {
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

// ── Where a story may be verified from ────────────────────────────────────
//
// The free feeds in scripts/lt-news-brief.mjs surface HEADLINES, not articles.
// A headline is enough to nominate a story and nowhere near enough to read a
// number out loud on air, so the editorial pass is given web search over this
// allowlist and told to confirm each story before it is written.
//
// The list is deliberately short and reputable: a crypto news show that quotes
// an aggregator quoting a press release is how a wrong number gets spoken in a
// character's voice, which is the one failure that is expensive to undo.
// Add to it as needed — it is an allowlist, so anything absent is simply
// unreachable rather than silently trusted.
export const NEWS_SOURCE_DOMAINS = [
  // Primary sources first — a rate decision or a bill should be confirmed from
  // the institution that issued it, not from somebody's coverage of it.
  "federalreserve.gov",
  "treasury.gov",
  "home.treasury.gov",
  "congress.gov",
  "bls.gov",
  "bea.gov",
  "eia.gov",
  "sec.gov",

  // General business and economics desks.
  "reuters.com",
  "apnews.com",
  "cnbc.com",
  "marketwatch.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "barrons.com",

  // Crypto desks.
  "coindesk.com",
  "theblock.co",
  "blockworks.co",
  "decrypt.co",
  "dlnews.com",
  "cointelegraph.com",

  // Data and prices, for checking a figure directly.
  "defillama.com",
  "farside.co.uk",
  "polymarket.com",
  "kalshi.com",
  "pricecharting.com",
  "tcgplayer.com",
];

// Bounds the cost of one editorial pass. Three stories plus the gauge is a
// handful of searches; anything far above this means the model is wandering.
export const MAX_SEARCHES_PER_RUNDOWN = 8;

// The web_search tool type below is available on Opus 4.6+ and Sonnet 4.6+.
// A cheaper model set via LT_NEWS_MODEL may reject it — run with --no-search.
export const WEB_SEARCH_TOOL_TYPE = "web_search_20260209";

// ── The rundown ───────────────────────────────────────────────────────────
//
// A fixed skeleton is the point: the same segments every week is what makes the
// show producible in an afternoon instead of designed from scratch. The word
// targets sum to about 950 words, which at ESTIMATED_WPM is roughly 6:33 — the
// middle of the 5–10 minute window, so a segment can run long without the
// episode falling out of it.
//
// The show is general investing and economics, not a crypto show: a week is the
// Fed, the ten-year, oil, a bill in Congress, the indices, crypto, and whatever
// people have newly decided is an asset. The story slots are deliberately not
// assigned to beats — the week decides which is the lead.
export const SEGMENTS = [
  {
    id: "cold-open",
    label: "Cold open",
    targetWords: 95,
    intent:
      "Connor welcomes the audience and previews the three stories in one breath. GR80 undercuts the preview in a line. Fast, no news yet.",
  },
  {
    id: "story-1",
    label: "Lead story",
    targetWords: 210,
    intent:
      "The week's biggest story, from ANY market — a rate decision, a bill moving through Congress, the ten-year, oil, the indices, or crypto. Connor states the fact with its number, GR80 reframes what the number actually measures, Connor pushes back, GR80 lands the button.",
  },
  {
    id: "story-2",
    label: "Second story",
    targetWords: 200,
    intent:
      "Same beat pattern, a different corner of the market from story one. If story one was macro, this is markets or crypto, and the other way round. Do not run two versions of the same story.",
  },
  {
    id: "the-spot",
    label: "The spot",
    targetWords: 55,
    intent:
      "A commercial-style read for RL80, played completely straight as an ad break and then punctured. Connor does the sponsor voice — grand, overclaimed, delighted. GR80 reads the disclaimer as if it were scripture, or refuses to read it. It is a joke about advertising, never a recommendation to buy anything. Skipped entirely when there is no spot copy for the week.",
  },
  {
    id: "story-3",
    label: "Third story",
    targetWords: 185,
    intent:
      "The week's absurd one — usually collectibles, a mania, or whatever people have newly decided is an asset. The comedy slot: Connor enjoys it, GR80 finds the uncomfortable truth underneath it.",
  },
  {
    id: "the-board",
    label: "The board",
    targetWords: 135,
    intent:
      "The week's numbers read as a board: the ten-year, the Fear & Greed arc, oil or gold if either moved, and ONE prediction-market line from Polymarket or Kalshi. Pick the three or four that actually moved; do not recite all of them. Ends on GR80 turning a number into a moral.",
  },
  {
    id: "sign-off",
    label: "Sign-off",
    targetWords: 70,
    intent:
      "Connor recaps the three stories in one sentence. GR80 closes the ledger and states plainly that none of it was a recommendation. Recurring closer — keep the shape week to week.",
  },
];

// The spot only runs when there is copy for it, so it is the one segment the
// script may legitimately omit.
export const OPTIONAL_SEGMENTS = new Set(["the-spot"]);


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
  Connor: [
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
