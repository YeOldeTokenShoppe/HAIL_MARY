// The LT TV news-show bible, in one place.
//
// Everything a script has to obey — who is on the set, which animation cues
// exist, how long a segment runs, how much text one ElevenLabs request can
// take — lives here rather than being restated in a prompt, a doc and a
// component. scripts/lt-news-script.mjs generates against it and validates
// against it; the audio build and the runtime read the same constants.

import {
  CHARACTERS as MODEL_CHARACTERS,
  reactionDurations,
} from "../src/lib/ltTv/modelContract.mjs";
import { FACES, FACE_NAMES, isFaceBeat } from "../src/lib/ltTv/faces.mjs";

// ── The cast ──────────────────────────────────────────────────────────────
//
// THE ROSTER, not the cast of any one episode. An episode casts whoever has
// lines in it: the record's `cast` block is built from who actually spoke, and
// the set counts that rather than the seats it can fill — so a character can
// be rotated out of a week, or sat down for one, without touching this file.
//
// THREE CHARACTERS as of 2026-09-22, two per episode: Connor anchors both
// shows, GR80 does Markets & Morality and the new co-anchor does the news.
// Who has a chair on which set is in src/lib/ltTv/modelContract.mjs, and a
// character with no seat on a set is not on it — so the split is geometry
// rather than a rule anybody has to remember.
//
// Each character now ships as their own GLB, so adding one is an entry in the
// contract, an entry here, and a SitePal scene of its own. What is NOT free is
// a personality paragraph in both writers, which is writing rather than
// plumbing. Written up under "Adding a character, rotating the cast, or a
// guest" in docs/lt-tv.md.
//
// `actor` is the only name this pipeline uses, and it is deliberately not the
// character's name: Connor's GLB node is still Demon_Empty and his processor
// key is still john, because those are strings inside a model file and an
// audio pipeline. `displayName` is what a viewer meets.
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
    voiceId: "bZ2WrEjNzHgFHfLLaFKQ",
    processorKey: "gr80", // → gr80-sitepal-balanced.wav
    clipKey: "gr80",
    role: "co-anchor",
  },
  // THE NEWS CO-ANCHOR, named by Michelle on 2026-09-22. `HOLLY JONES` is the
  // speaker cue in a screenplay; a two-word cue already works, since GR80's is
  // `SAINT GR80`.
  //
  // `clipKey` is what her SitePal clips will be called
  // (lttv_news_ep01_holly). Chosen now because she has not recorded one yet,
  // and a clip name is whatever was typed at upload — so this is the only
  // moment it is free to pick.
  //
  // WHAT IS STILL MISSING is a paragraph on who she is against Connor, in both
  // writers' prompts. Until it exists the news writer does not know she is the
  // one in that seat, and would go on writing GR80 into the news.
  Holly: {
    actor: "Holly",
    displayName: "Holly Jones",
    voiceId: "wRBnwLc9kmVUe7Iim1Qo",
    processorKey: "holly",
    clipKey: "holly",
    role: "co-anchor",
  },
  // THE NEWS ANCHOR from 2026-09-23, in Connor's news seat (Connor stays on
  // Markets & Morality). Voice from Michelle the same day. His clips will be
  // lttv_news_epNN_kip.
  Kip: {
    actor: "Kip",
    displayName: "Kip O'Brien",
    voiceId: "PrphkIjVNo6xpWZI8duh",
    processorKey: "kip",
    clipKey: "kip",
    role: "anchor",
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
// WHICH CUES EACH RIG CAN ACTUALLY PERFORM, and how long each clip is.
//
// Derived from the model contract, which is the single place these are
// written. This was a hand-maintained copy, as were the lists in
// TalkShowScene.jsx and lt-tv-check.mjs — three copies of one fact, each with
// a comment asking the next person to keep them in step. Two copies of a clip
// name is what put Connor in a T-pose.
//
// It matters here because the writers are OFFERED these names: a cue naming a
// clip the rig has not got does nothing on screen. The news co-anchor has two
// gestures where the other two have six or seven, so the prompt must be built
// from this rather than from prose about what a character can do.
export const REACTIONS = Object.fromEntries(
  Object.entries(MODEL_CHARACTERS).map(([actor, c]) => [actor, reactionDurations(c)]),
);

// ── Face beats ────────────────────────────────────────────────────────────
//
// SitePal expressions, cued exactly like a reaction — see
// src/lib/ltTv/faces.mjs. Every character on the set is a SitePal face, so
// every one of them has all of these. REACTIONS stays the body clips only,
// because that is what the writers are offered per character; BEATS is every
// name a cue may carry, with how long it lasts, and is what a cue is checked
// against.
export { FACES, FACE_NAMES, isFaceBeat };

for (const [actor, clips] of Object.entries(REACTIONS)) {
  const clash = FACE_NAMES.filter((f) => f in clips);
  // One cue name meaning two things would fire whichever the set checks first.
  if (clash.length) throw new Error(`${actor} has a body clip named like a face beat: ${clash.join(", ")}`);
}

// What BOTH writers are told about faces. One string, because the two
// writers' prompts are otherwise separate files and a rule written twice is
// a rule that drifts — and the room reads each writer's bible, so it gets
// this too.
export const FACE_BEAT_RULES = `FACE BEATS: the same "cues" array also takes facial expressions, which SitePal performs on that character's own face: ${FACE_NAMES.join(", ")}. A face beat is written exactly like a body beat — { "actor", "reaction": "smile", "offset" } — and every character has every face. Use one where the face says something the words do not: the speaker's smile on a line they are enjoying, the listener's disgusted look at a bad trade, thinking just before a considered answer, surprise at a number. There are two smiles: "smile" is closed-mouth and quiet, "grin" is open-mouth and delighted. Aim for roughly one face beat every four or five lines across the episode, no more than one per line, and never the same face on the same character twice running. A face holds about three seconds and relaxes by itself, and it shows whether or not that character is talking — so decide for each face whether it lands DURING the words or AFTER them. During: put it on the character's own line, early (offset 0.3 to 1), for a smile through a line they are enjoying. After: put it on the NEXT line, the one the other character speaks, at offset 0.2 or so, so it reads as a reaction to what was just said — the disgusted look lands as the other host starts talking, not over the punchline. Faces follow character: Connor's are knowing — a smile that is a smirk, a grin at someone else's bad trade, surprise that is mock innocence — and never sadness or fear in earnest. These are drafts: the producer reads the script through and deletes any that land wrong, so place each one where you mean it rather than to fill a quota.`;

export const BEATS = Object.fromEntries(
  Object.entries(REACTIONS).map(([actor, clips]) => [
    actor,
    { ...clips, ...Object.fromEntries(FACE_NAMES.map((f) => [f, FACES[f].duration])) },
  ]),
);

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
  // MARKETS & MORALITY IS THE ROUNDTABLE'S FORMAT UNDER ITS OWN BANNER. Same
  // two seats, same six-segment argument, same runtime window, same generator
  // (`lt-rt-script.mjs` writes either show). It exists as a separate show
  // because the slate sorts the moral arguments out of the roundtable queue,
  // not because anything about the writing differs — so this shares
  // ROUNDTABLE_SEGMENTS rather than copying them, and a check the roundtable
  // gains, this gains.
  morality: {
    id: "morality",
    title: "Markets & Morality",
    segments: ROUNDTABLE_SEGMENTS,
    optional: new Set(),
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
  // Droll is the whole performance, so her tags are the ones that keep a joke
  // from being announced. Nothing warm and nothing surprised: she is a machine
  // reading the numbers, and the humour is that she is not impressed by them.
  Holly: ["[dryly]", "[flatly]", "[mildly]", "[unimpressed]", "[brightly]"],
  // Network gravity, from Michelle's brief for him (2026-09-23): commanding on
  // the headlines, warm on ordinary news, grave about trivia, and a hint of
  // smug amusement at the end of a punchline. Nothing goofy.
  Kip: ["[gravely]", "[solemnly]", "[authoritatively]", "[warmly]", "[with quiet satisfaction]"],
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

// ── Titles ────────────────────────────────────────────────────────────────
//
// The first generated news episode came back titled "Hike Barrel Charizard" —
// one noun from each of its three stories, jammed together. It is what a model
// does when the only instruction is a word count: it tries to cover the whole
// episode in four words and produces a keyword list instead of a title.
//
// So the rule is stated as the job it actually is — name ONE thing the way a
// programme guide would — and it is shared by both shows, because both shows
// title episodes and neither wants a keyword list.
export const TITLE_RULES = `THE TITLE — this is what the channel guide prints under the thumbnail, so write it as a title and not as a summary of the episode:
- Name ONE thing. Usually the lead story, or the mood the week had. An episode does not need a title that covers all three stories, and trying to write one is how you get a list of nouns.
- It has to read as English out loud. Say it to yourself. "Hike Barrel Charizard" is three story keywords in a row, not a title, and it is the exact failure to avoid.
- Two to six words. Title case. No colon, no slash, no ampersand, no dash joining two ideas.
- No episode number, no week number, no date, and no bare ticker or number — the guide already shows those.
- Do not reuse the chiron headline word for word. The headline reports; the title characterises.
- A little wit is welcome, a pun is fine, jargon is not.
Titles of the right shape: "The Cut That Wasn't", "Everyone Is a Bond Trader Now", "Cardboard Gold Rush", "Nobody Told the Oil Market", "A Very Expensive Shrug".`;

// ── Acronyms ──────────────────────────────────────────────────────────────
//
// The audience is LISTENING. An acronym nobody expands is a sound, not a word:
// the first news episode said "FRED" four times and never once said what FRED
// is. So an acronym is expanded on first mention and used short after that,
// and `assemble()` warns when a script does not.
//
// Keys are spoken exactly as written. `expansion` is what has to appear in the
// same line or an earlier one; `also` lists other wordings that count as having
// expanded it, so a line that says "the Fed's economic data service" is not
// nagged into saying the official name twice.
export const SPOKEN_ACRONYMS = {
  FRED: { expansion: "Federal Reserve Economic Data", also: ["Federal Reserve's economic data"] },
  FOMC: { expansion: "Federal Open Market Committee", also: [] },
  CPI: { expansion: "Consumer Price Index", also: ["consumer prices"] },
  PCE: { expansion: "Personal Consumption Expenditures", also: [] },
  PPI: { expansion: "Producer Price Index", also: ["producer prices"] },
  BLS: { expansion: "Bureau of Labor Statistics", also: [] },
  GDP: { expansion: "gross domestic product", also: [] },
  ETF: { expansion: "exchange-traded fund", also: ["exchange traded fund"] },
  ISM: { expansion: "Institute for Supply Management", also: [] },
  PMI: { expansion: "Purchasing Managers Index", also: ["purchasing managers"] },
  IPO: { expansion: "initial public offering", also: [] },
  NFT: { expansion: "non-fungible token", also: ["nonfungible token"] },
  AUM: { expansion: "assets under management", also: [] },
  APY: { expansion: "annual percentage yield", also: [] },
  APR: { expansion: "annual percentage rate", also: [] },
  QT: { expansion: "quantitative tightening", also: [] },
  QE: { expansion: "quantitative easing", also: [] },
};

// Said out loud every day by people who do not know what they stand for, and
// expanding them on air sounds like a lecture. Listed rather than merely
// omitted so the next person knows the omission was a decision.
export const ACRONYMS_TAKEN_AS_READ = ["the Fed", "SEC", "IRS", "CEO", "CFO", "US", "AI", "ATM", "TV", "FOMO", "OK"];

/**
 * Acronyms spoken before anything says what they stand for.
 *
 * Reads the episode in spoken order and reports the FIRST offending mention of
 * each acronym only — a second warning about the same word tells a producer
 * nothing new and buries the ones that matter.
 *
 * @param lines — [{ n, text }] in spoken order.
 * @returns [{ n, acronym, expansion }]
 */
export function unexpandedAcronyms(lines) {
  const found = [];
  const expanded = new Set();

  for (const line of lines) {
    const text = String(line.text || "");
    const lower = text.toLowerCase();

    for (const [acronym, { expansion, also }] of Object.entries(SPOKEN_ACRONYMS)) {
      const spelled = [expansion, ...(also || [])].some((form) => lower.includes(form.toLowerCase()));
      // Checked BEFORE the mention test, so a line that expands and abbreviates
      // in one breath — "Federal Reserve Economic Data, FRED for short" — is
      // exactly right rather than a warning.
      if (spelled) expanded.add(acronym);
      if (expanded.has(acronym)) continue;

      // Plural and possessive count as a mention; a longer word that merely
      // contains the letters does not.
      if (new RegExp(`\\b${acronym}(?:s|'s|s')?\\b`).test(text)) {
        found.push({ n: line.n, acronym, expansion });
        // Reported once. After this the script is wrong in a way the producer
        // has been told about, and repeating it per mention only adds noise.
        expanded.add(acronym);
      }
    }
  }

  return found;
}
