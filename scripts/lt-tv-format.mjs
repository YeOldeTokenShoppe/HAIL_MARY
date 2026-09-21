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
// Demon_Empty (actor "Connor") and Monk_Empty (actor "Monk") and nothing else,
// so a news desk with a third voice is not producible on this set today.
//
// The character is CONNOR, and the runtime agrees: CHARACTER_CLIPS and
// process_dialogue.py's ACTOR_NAMES both say "Connor" now. What is left is
// plumbing that was never his name — the GLB node is Demon_Empty, the baked
// animation clips are barron_*, and the processor's speaker key is john.
// Those are strings inside the model file and the audio pipeline; `actor`
// below is the only name this pipeline uses.
export const CAST = {
  Connor: {
    actor: "Connor",
    displayName: "Connor",
    voiceId: "IcFWazAaBzXNwLWpySgF",
    processorKey: "john", // process_dialogue.py SPEAKERS key → john-sitepal-balanced.wav
    clipKey: "connor", // the SitePal clip-name suffix
    role: "anchor",
  },
  Monk: {
    actor: "Monk",
    displayName: "Saint GR80",
    voiceId: "Re5c3vCmpnygdZuSX2Wc",
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
// docs/talk-show-production.md): lttv_<show>_ep<NN>_<character>, following the
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
  "fred.stlouisfed.org",
  "stlouisfed.org",

  // General business and economics desks. Six obvious names are missing on
  // purpose: reuters.com, apnews.com, wsj.com, ft.com, marketwatch.com and
  // barrons.com block Anthropic's crawler, and the web search tool rejects the
  // whole request with a 400 ("not accessible to our user agent") if any one of
  // them is on the allowlist. Seen live on 2026-09-21. Before adding an
  // outlet, check that it does not appear in that error.
  "cnbc.com",
  "bloomberg.com",

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

// ── The roundtable's shape ────────────────────────────────────────────────
//
// The Liminal Terminal is not a news show and does not borrow the news show's
// skeleton. It is a two-hander argument about one idea, and the thing that
// makes an episode work is that BOTH characters are right about something.
// Connor is not a fool who exists to be corrected, and GR80 is not a scold who
// wins by default — the roundtable-01 recording earns its ending because
// Connor's position survives contact with the moral case and is only bent by
// it. A skeleton that walks straight from "Connor is wrong" to "GR80 explains
// why" produces five minutes nobody wants to hear twice.
//
// So the middle of the show is a hard case that costs them both something,
// and the concession is partial and in character. The closer is deliberately
// the same shape every week, the way a real show's closer is.

export const ROUNDTABLE_SEGMENTS = [
  {
    id: "the-question",
    label: "The question",
    targetWords: 110,
    intent:
      "Connor welcomes the audience and puts tonight's idea as one concrete question — a thought experiment with a choice in it, not a topic. GR80 answers by finding the flaw in how the question was asked. No positions yet; the audience should want the answer.",
  },
  {
    id: "the-case",
    label: "The case",
    targetWords: 170,
    intent:
      "Connor makes the strongest HONEST case for the market's side of it: what the mechanism actually does well, who it actually helps, why a sensible person believes it. Write the version a smart opponent would concede is fair. GR80 presses on specifics rather than disagreeing yet.",
  },
  {
    id: "the-turn",
    label: "The turn",
    targetWords: 170,
    intent:
      "GR80 reframes. He does not contradict the case — he names what it quietly costs and who is not in the room to object. This is the moral centre of the episode and it should land as a reframing the audience had not made themselves. Connor feels it and does not yet concede.",
  },
  {
    id: "the-hard-case",
    label: "The hard case",
    targetWords: 180,
    intent:
      "One specific, concrete example that is uncomfortable for BOTH of them — where Connor's principle produces something he does not like, and GR80's produces something he cannot pay for. Neither gets a clean win here. This is the segment that keeps the show from being a sermon.",
  },
  {
    id: "the-concession",
    label: "The concession",
    targetWords: 120,
    intent:
      "One of them gives ground, partially, and entirely in character — Connor concedes the moral point while keeping the position, or GR80 concedes the practical one while keeping the judgment. It is a real concession, not a setup for a better line.",
  },
  {
    id: "the-close",
    label: "The close",
    targetWords: 90,
    intent:
      "GR80 lands the idea in one sentence a listener could repeat tomorrow. Connor keeps his position and is visibly changed by about ten percent, which is the most this show ever grants. Recurring closer — keep the shape week to week.",
  },
];

// ── The shows, as the pipeline sees them ──────────────────────────────────
//
// Both shows share the set, the cast, the recording blocks, the record format
// and the audio build. They differ in their segment skeleton, how long an
// episode runs, and whether there is a chiron. Collecting those differences
// here is what lets one `assemble()` serve both — the alternative is a second
// copy of the generator that drifts out of step with the first.

export const SHOW_FORMATS = {
  news: {
    id: "news",
    title: "LT Weekly News Recap",
    segments: SEGMENTS,
    optional: OPTIONAL_SEGMENTS,
    // Michelle's call: a weekly recap people put on is five to ten minutes.
    runtime: { min: 300, max: 600 },
    graphicsMode: "news",
    // A news episode is identified by the week it covers; a roundtable is not.
    dated: true,
  },
  roundtable: {
    id: "roundtable",
    title: "The Liminal Terminal",
    segments: ROUNDTABLE_SEGMENTS,
    optional: new Set(),
    // Shorter at the top end than the news show: this is one argument, and an
    // argument that runs ten minutes has started repeating itself.
    runtime: { min: 240, max: 540 },
    graphicsMode: null,
    dated: false,
  },
};

export function showFormat(id) {
  const format = SHOW_FORMATS[id];
  if (!format) {
    throw new Error(`Unknown show "${id}" — expected one of ${Object.keys(SHOW_FORMATS).join(", ")}.`);
  }
  return format;
}


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
