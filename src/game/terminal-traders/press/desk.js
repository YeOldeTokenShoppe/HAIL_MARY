// THE DESK — who sits where, and the global line banks.
//
// Everything here is ARCHETYPE-AGNOSTIC and paid for once. An archetype
// authors claims; it never authors a word for Eugene or for an adviser's
// dispatch, so adding read #3 through #13 costs nothing on this axis.
//
// ~40 lines of prose, reused forever. That is the whole point of moving the
// four-character layer here instead of into the archetypes.

import { LANES, PITCHER, SEATS, SHAPES, inLane } from "./questions.js";
// Explicit .js, like every other specifier in this directory: the harness
// (scripts/verify-press-run.mjs) imports desk.js directly under Node ESM, which
// will not resolve an extensionless path. Bare "./pitchers" bundles fine and
// took the harness red — a silent failure, because only Node ever sees it.
import { pitcherPortrait, pitcherVoice, pitcherModel } from "./pitchers.js";

/**
 * THE PITCH BOT — the thing you press. Not a seat, not staff, not yours.
 *
 * Founders employ pitch agents; that is the convention of this world rather than
 * a production shortcut, which is why the founder never appears and why their
 * absence needs no explaining. It works on COMMISSION, and that is load-bearing
 * rather than colour: SHAPES.POSITIONED ("the speaker benefits from you believing
 * it") is live in all three archetypes, and a paid closer's interest is
 * structurally undeniable where an owner's is deniable.
 *
 * `face` is keyed to the pressure band and to NOTHING ELSE — see PITCHER_ASIDE
 * below and invariant 9. The plate (SM_Chr_Kid_Robot_Face_01) is unskinned and
 * untouched by both clips, so a texture swap can never fight the mixer. Base
 * colour and emissive share one image in the GLB: set `map` AND `emissiveMap`.
 */
export const PITCH_BOT = {
  id: PITCHER,
  // "The Agent" until 2026-07-29. Renamed on the author's call — "we can call it
  // 'pitch bot' instead of 'agent'" — and it is the better name for the same
  // reason the copy stopped calling attention to the absent client: AGENT is a
  // role that invites the question "agent for whom, and where are they", while
  // PITCH BOT is just what the thing is. This is desk data, so the rename reaches
  // the record, the seat row, the transcript and Barron's asides at once.
  name: "Pitch Bot",
  role: "PITCHING ON COMMISSION",
  model: "/models/pitch-bot.glb",   // 566KB. Draco + EXT_texture_webp required.
  // Its own render, 2026-07-29. This was thumbnail_johnBarron.png as a
  // placeholder for a few hours, which put THE SAME FACE on the pitcher tile and
  // on Barron's tile two seats apart in the same row — the cast-legibility
  // failure this whole refactor exists to fix. SeatRow still falls back to a
  // glyph if this is ever null; a borrowed face is never an acceptable fallback.
  /**
   * A GETTER, so the four render sites (engagement, PressFlat, PressSession,
   * pressUi) keep reading `.portrait` and get the STAGED rig's face without any
   * of them learning about variants.
   *
   * Resolved through press/pitchers — the same function lib/trade/pitchBotScene
   * uses to decide which glb to load, so the tile and the thing in the beam
   * cannot disagree. That module is deliberately three-free: this file is
   * imported by PressFlat, which has no WebGL at all.
   */
  get portrait() { return pitcherPortrait(); },
  /** Also per-rig — see the note on `portrait`. */
  get voice() { return pitcherVoice(); },
  /** Also per-rig: the shell's plate number, printed on the file. */
  get model() { return pitcherModel(); },
  clips: { idle: "idle", talking: "talking" },
  blurb: "Paid if you fund it. That is the entire relationship.",
};

// VOICE IS DESK DATA TOO, for the same reason as the portrait: both surfaces need
// it and neither should own it. The key indexes VOICES in api/counsel-voice —
// JB / MR / GR / EU for the seats, PB for the pitcher. Before this, the press
// floor voiced EVERY line as the pitcher, so a press on Eugene came back in the
// bot's voice reading Eugene's finding (author, 2026-07-29).
//
// PORTRAITS ARE DESK DATA, NOT SURFACE DATA. They used to be a `cardId` that
// each surface resolved into a Genesis card face through dealCard.js. Cards
// were cut from this game on 2026-07-28, so what a seat looks like is now just
// a path, and it belongs next to the name and the lane rather than being
// re-derived identically on two surfaces.
//
// These four are renders of the SAME models that sit in the room, against the
// same grid backdrop, so the tiles and the scene agree with each other.
/* THE SEATS' LIVE PLAYERS — the same shape VIRGIL.sitepal carries, and here for
 * the same reason: a still cannot lip-sync, and the amplitude path this surface
 * used instead was driving nothing on the three seats with no mouth art. See
 * lib/trade/seatVoice.js.
 *
 * ENGINE 14 IS THE WHOLE POINT AND IT IS NOT SITEPAL'S OWN TTS. It is
 * ElevenLabs through the SitePal-connected account, so `voice` is the EL voice
 * UUID rather than one of the numbered built-ins — the player fetches the SAME
 * voice our API would have, and lip-syncs the audio it just made. That is what
 * makes clip uploads unnecessary: `sayAudio` resolves names in the account and
 * never URLs, but `sayText` on engine 14 takes arbitrary text.
 *
 * THE IDS MUST STAY IN LOCKSTEP WITH api/counsel-voice. Each `voice.voice`
 * below is that seat's entry in that route's VOICES map, and it has to be,
 * because the two paths are chosen at RUNTIME by whether a portal happened to
 * load. If they diverge, the character changes voice depending on that — which
 * is the exact bug GR80 hit across /main's two layouts (SitePal Gilbert on one,
 * ElevenLabs on the other). If an id moves in that route, move it here in the
 * same commit; the harness asserts they match.
 *
 * `embedContext: 1` DELIBERATELY DISAGREES WITH THE EMBED SNIPPET, which prints
 * 0 — SitePal's docs require 1 under a JS framework, and Virgil's config
 * records the same override for the same reason. Only account, sceneId, hash
 * and voice are load-bearing.
 *
 * EUGENE IS ABSENT ON PURPOSE. He has no scene (an equine head needed a custom
 * build) and he does not need one: his mouth is drawn, and measured — see
 * MOUTH_SEATS in PressFigure. */
const SITEPAL_ACCOUNT = "9308752";

export const DESK = {
  [SEATS.BARRON]: {
    id: SEATS.BARRON, agentId: "Demon", station: "demon",
    name: "Connor", role: "THE CHART", lane: LANES.CHART,
    portrait: "/thumbnail_johnBarron.png", voice: "JB",
    sitepal: {
      label: "Connor", account: SITEPAL_ACCOUNT,
      sceneId: 2775052, hash: "IMtOuXOufh3OnQ9ZYUXc2DoYe39vRePb",
      embedContext: 1,
      voice: { voice: "IcFWazAaBzXNwLWpySgF", lang: 1, engine: 14 },
    },
    // HE NO LONGER BRINGS THE DEAL IN. That was the sentence that made him both
    // adversary and seat, and it is the pitch bot's job now. What he is instead:
    // a tape reader, short-biased and vice-prone, which is a DISPOSITION the
    // player will over-discount — the same lesson Marisol teaches from the
    // opposite side. The messenger's disposition is not evidence.
    blurb: "Price, windows, momentum. Reads the tape, and reads it short.",
  },
  [SEATS.MARISOL]: {
    id: SEATS.MARISOL, agentId: "Detective", station: "marisol",
    name: "Detective Marisol", role: "THE MONEY", lane: LANES.CHAIN,
    portrait: "/thumbnail_marisol.png", voice: "MR",
    sitepal: {
      label: "Detective Marisol", account: SITEPAL_ACCOUNT,
      sceneId: 2774916, hash: "R87HgVkKE6AFibw6Ih3VPGVc5eRGMY63",
      embedContext: 1,
      voice: { voice: "jdWlEMh784XiUSTLzNso", lang: 1, engine: 14 },
    },
    blurb: "Money movement, wallet ages, unlocks.",
  },
  [SEATS.GR80]: {
    id: SEATS.GR80, agentId: "Monk", station: "monk",
    name: "Saint GR80", role: "REPUTATION", lane: LANES.RECORD,
    portrait: "/thumbnail_gr80.png", voice: "GR",
    sitepal: {
      label: "Saint GR80", account: SITEPAL_ACCOUNT,
      sceneId: 2775053, hash: "I0s05E8rXxvHYHdJIPmcIU5msqkW6t0A",
      embedContext: 1,
      voice: { voice: "JBFqnCBsd6RMkjVDRZzb", lang: 1, engine: 14 },
    },
    blurb: "What the documents actually say.",
  },
  [SEATS.EUGENE]: {
    id: SEATS.EUGENE, agentId: "RL80", station: "eugene",
    name: "Eugene", role: "THE STORY", lane: LANES.SOCIAL,
    portrait: "/thumbnail_eugene.png", voice: "EU",
    blurb: "Narrative, reputation, who vouches for whom.",
  },
};

/**
 * WHO IS THIS, for anything `seatOptions` hands a surface.
 *
 * `seatOptions` returns [PITCHER, ...four seats], and the pitcher is deliberately
 * not in DESK — it isn't staff. Every render site needs one lookup that covers
 * both, or each surface grows its own `id === PITCHER ? ... : DESK[id]` ternary
 * and they drift. That drift is exactly how the seat migration produced four
 * bugs from one cause; see the note at the top of pressUi.jsx.
 */
export function seatMeta(id) {
  return id === PITCHER ? PITCH_BOT : (DESK[id] ?? null);
}

/** Seat order for every row that shows the whole desk. Barron first because he
 *  reads the chart the pitch leans on; the rest follow in lane order. */
export const DESK_ORDER = [
  DESK[SEATS.BARRON], DESK[SEATS.MARISOL], DESK[SEATS.GR80], DESK[SEATS.EUGENE],
];

/**
 * Eugene is a PLAIN FOURTH SEAT (SOCIAL) — one use, no exemption. Kept as a
 * named export only because a lot of code refers to him directly.
 *
 * He used to do two things: RETRIEVAL like everyone else, plus a free
 * RECOGNITION read on every claim. That second power is what made him the one
 * seat in four that needed explaining, and it is now the cat's (./virgil.js).
 * The answer to "why does Eugene have the special role" is that he no longer
 * does. What he retrieves: sent at a SOCIAL claim he comes back with who
 * actually vouches for whom, and stamps it on his own board (__screen4Canvas,
 * which existed unused all along).
 */
export const EUGENE = DESK[SEATS.EUGENE];

/**
 * What a lane is CALLED on screen. The enum is CHAIN / RECORD / CHART / SOCIAL
 * in code, but "RECORD QUESTION" reads as an instruction to record something —
 * noun or verb, you can't tell ("is 'Record' a verb or noun here?" — author,
 * 2026-07-27). Player-facing copy uses a plain noun phrase.
 *
 * CHART WAS "THE TAPE" UNTIL 2026-07-28. Ticker-tape slang: reading the tape is
 * watching price and volume action. It was the only one of the four that needed
 * to be known rather than read — "the money", "the paperwork" and "the story"
 * are plain and it wasn't — and it failed on the author, who asked what it
 * meant. That is invariant 6 (every player-facing term must parse with no
 * finance literacy) catching a term the same way it caught "Brier" and
 * "diligence". Barron still SAYS "tape" in his own dialogue, because he's the
 * one with the jargon; the UI no longer says it back.
 */
export const LANE_LABEL = {
  [LANES.CHAIN]: "the money",
  [LANES.RECORD]: "reputation",
  [LANES.CHART]: "the chart",
  [LANES.SOCIAL]: "the story",
  [LANES.SHAPE]: "nobody's specialism",
};

/** Who is the SPECIALIST for this claim. Null only on a LANES.SHAPE claim. */
export function laneOwner(claim) {
  if (!claim) return null;
  return Object.values(DESK).find((d) => d.lane === claim.lane) || null;
}

/**
 * The whole band, as one sentence.
 *
 * IT NO LONGER SAYS "ONLY X CAN SETTLE IT", BECAUSE THAT IS NO LONGER TRUE.
 * Under the gate model it was accurate and still managed to be wrong twice: it
 * named a spent adviser as the way through, and it made two of four seats look
 * like broken buttons. Under the gradient model anyone can be sent at anything,
 * so the band names who goes DEEP and lets you price the shallow alternative.
 *
 * Once the specialist is spent the claim isn't closed, it's capped — every
 * remaining seat still answers, just shallowly — and the copy has to say
 * exactly that, or it reproduces the old lie in a new place.
 */
export function laneSentence(claim, { spent = [] } = {}) {
  if (!claim) return "";
  const who = laneOwner(claim);
  /* IT IS THE CAT SAYING IT NOW (author, 2026-08-04), so it is sentence case
     and it is addressed to you. It used to be a shouty colour-coded BAND in its
     own box directly above Virgil — two panels, stacked, both answering "who
     should look at this", which is what made the column read as a stack of
     labels. The band is gone; this string moved into Virgil's block.

     THE SPENT BRANCH IS NOT DECORATION — invariant 8: the floor may never issue
     an instruction the controller would reject, and this shipped once without
     the check and named an already-spent adviser as the way through. It stays,
     whoever is speaking it.

     IT ALSO STILL MAY NOT BE RESTATED BY THE TIP. The rule directly below this
     function ("THE READ MAY NEVER RESTATE THE LANE BAND") survives the move and
     matters more now that both lines are in one voice: the tip names the SHAPE
     of the argument, this names WHOSE it is, and they must not converge. */
  if (!who) return "Nobody here specialises in this one — anyone you ask gets the shallow version.";
  const label = LANE_LABEL[claim.lane].toLowerCase();
  if (spent.includes(who.id)) {
    return `This one's about ${label} — ${who.name}'s specialty, and ${who.name} is spent. Anyone else gets the shallow version.`;
  }
  return `This one's about ${label} — this is ${who.name}'s specialty.`;
}

// THE FREE READ MOVED TO THE CAT (./virgil.js). It was Eugene's, which made him
// the one seat in four with a permanent extra power — reported three times
// through three different implementations before the asymmetry itself was
// recognised as the problem. He is a plain fourth seat now.
//
// TWO RULES SURVIVE THE MOVE, and they are the reason this note stays here
// rather than going with him:
//
// 1. THE READ MAY NEVER RESTATE THE LANE BAND. It shipped as a LANE_READ bank —
//    "That one's onchain. Marisol can settle it." — word for word what the
//    colour-coded band directly above it already said. Half the output restated
//    the UI and the other half was an adjective, which is how a voice ends up
//    reading as having no job. What replaced it is HOW MUCH RUNWAY IS LEFT IN
//    THIS LANE: nothing else on the floor knows that, and it changes the
//    decision the game is actually about — spend Marisol on this money
//    question, or hold her for a better one. "Last one you'll get" and "three
//    more coming" are different games.
//
// 2. SINGULAR AND PLURAL ARE BOTH AUTHORED, because the plural is not always a
//    trailing "s": "question about the tape" pluralises on the HEAD noun, and
//    appending to the phrase produced "two more question about the tapes".
//    Latent under today's archetypes — CHART and SOCIAL never reach
//    remaining >= 2 — so it would ship silently the day a third social slot
//    lands.


// HOW THE PITCHER CARRIES IT AFTER YOU'VE HAD A GO AT IT.
//
// Delivered as an ASIDE before the next claim, so the pitch visibly changes shape
// as the room turns. Fourteen lines, archetype-agnostic, paid for once — a new
// archetype adds none. None of them names a fact, an outcome or a lane; they are
// posture only, so no line here can ever carry information the pressure score
// didn't already give you.
//
// THESE WERE BARRON'S UNTIL 2026-07-29 and moved wholesale to the bot, which is
// what §7 item 2 predicted ("mostly generic enough to survive, worth
// re-reading"). One line did not survive the move: "Everyone at this table has
// shipped something" was Barron appealing to the DESK, which an outside agent
// cannot do — it now appeals to the client instead.
//
// It never apologises and never concedes. A closer who folds is a different
// character, and a much less interesting one to have to read.
const PITCHER_ASIDE = {
  backed: [
    "Check it again if you like. It'll say the same thing.",
    "Good. Ask me another one.",
    "That's what I like. Somebody who actually looks.",
    "You'll find I don't say things I can't stand behind.",
  ],
  rattled: [
    "I'm not sure what you think you found there.",
    "Alright. You want to do this the long way.",
    // NOTE: "records" and "paperwork" are forbidden here — RECORD is a lane and
    // THE PAPERWORK is GR80's role label, so either word in Barron's mouth
    // reads as him naming a lane. Pinned by an assertion.
    "That's a bookkeeping gap, not a business one.",
    "Show me a company with no loose ends. I'll wait.",
    "You can keep pulling threads. It's your afternoon.",
  ],
  cornered: [
    "You've made your mind up. Let me finish anyway.",
    "My client has shipped something. Let's not pretend that's nothing.",
    "Fine — you want the version with every caveat in it? Here it is.",
    "I've watched people talk themselves out of the best deal of their career.",
    "Ask the next one. I'd rather you asked than sat there deciding quietly.",
  ],
};

/**
 * His aside for the claim about to be delivered, or "" while he's still
 * comfortable. Deterministic in (band, index) so a replay is identical.
 *
 * ROTATES ON THE CLAIM INDEX, not on anything about the claim. Keying it to
 * `claim.id.length` made two consecutive claims with same-length ids repeat the
 * line verbatim, which reads as a stuck component rather than a character.
 * Index rotation can't collide with itself.
 */
export function pitcherAside(band, claim, index = 0) {
  const bank = PITCHER_ASIDE[band];
  if (!bank || !claim) return "";
  return bank[((index % bank.length) + bank.length) % bank.length];
}

/** @deprecated Pre-bot name. Kept so both surfaces keep rendering across the
 *  refactor — drop it once PressSession and PressFlat call pitcherAside. */
export const barronAside = pitcherAside;

/* ---------------------------------------------------------------------- *
 * THE OPENING — what it says before the first claim.
 *
 * IT USED TO SAY NOTHING. HEAR THE PITCH cut straight to claim 1, so the bot
 * arrived already mid-argument: "appears to be speaking in the middle of the
 * pitch with no intro" (author, 2026-08-02). Every other beat in this game is
 * staged — the record arrives, the analysts are introduced, the reveal has a
 * curtain call — and the one moment the antagonist walks into the room had no
 * staging at all.
 *
 * THE SECOND LINE IS THE GAME'S THESIS, IN THE ANTAGONIST'S OWN MOUTH. §1: "Every
 * fact stated is true. What you judge is the inference sold on top of it." A
 * player who has not read the design doc has no way to know that unless somebody
 * says it, and the bot saying it is strictly better than a tooltip: it is in
 * character (a closer's honesty about being a closer is itself a closing
 * technique), it cannot be mistaken for instructions, and it makes the whole
 * session an offer rather than a quiz. It also stops the obvious wrong read —
 * "find the lie" — before it forms. There is no lie.
 *
 * IT MAY NOT SAY ANYTHING THE RECORD HASN'T ALREADY SAID. Name, ticker and chain
 * are on the engagement record by the time this plays (identity is settled before
 * HEAR THE PITCH exists), and the claim count is on the agenda rail. Nothing here
 * touches backing, lane or outcome — invariant 7 binds this bank like everything
 * else, and the surface numbers are uncorrelated by construction anyway.
 *
 * DETERMINISTIC IN THE DEAL, so a replay from a seed is identical. Keyed off
 * `deal.id` (`archetype:seed`) rather than a counter, because the variant has to
 * survive a remount — a useState index would re-roll the greeting if the floor
 * ever re-mounted mid-session.
 * ---------------------------------------------------------------------- */
/* MEASURED, NOT ESTIMATED. Voiced end to end, the first draft of this bank ran
   20.1s from HEAR THE PITCH to claim 1 — 6.4 / 8.8 / 4.8 — against a session
   that is meant to be about four minutes. Trimmed to land near 15s.
   Line 2 was NOT cut down as hard as the other two: it is the only one carrying
   anything the player can't get elsewhere, and "not a liar, but selective" is
   two halves of one idea rather than the same idea twice. Line 3 is the one that
   can afford to be short — the counter, the agenda rail and the briefing all say
   the same thing — but it can't be CUT, or the disclosure runs straight into
   claim 1 with no hand-off and the beat ends on a jolt.
   If you edit these, re-measure; the audio dominates and character count is the
   only lever on it. */
const PITCH_OPENING = [
  [
    (d) => `Thanks for the slot. I'm here for ${d.name} — ${d.ticker}, on ${d.chain}.`,
    () => "Up front: I'm on commission. I only earn if you fund this. Everything I tell you is true — I just pick which true things.",
    (d) => `${d.count} points. Stop me whenever.`,
  ],
  [
    (d) => `Appreciate the time. I represent ${d.name} — ${d.ticker}, ${d.chain}.`,
    () => "I only get paid if this closes. That doesn't make me a liar — it makes me selective. Nothing I say is false.",
    (d) => `${d.count} things for you. Interrupt when you like.`,
  ],
  [
    (d) => `Good — you took the meeting. ${d.name}. ${d.ticker}, ${d.chain}.`,
    // THE THREE VARIANTS ARE THE SAME LENGTH ON PURPOSE (~106-115 chars). This
    // one was 132 and ran ~9.2s against the others' ~7, so which greeting the
    // seed rolled changed how long the beat took by two seconds.
    () => "Disclosure: I'm on commission. I won't tell you anything untrue — I'm just not obliged to tell you all of it.",
    (d) => `The case is ${d.count} parts. Cut in whenever.`,
  ],
];

/** Stable small hash — same string always picks the same variant. */
function variantOf(key, n) {
  let h = 0;
  for (let i = 0; i < String(key).length; i++) h = (h * 31 + String(key).charCodeAt(i)) | 0;
  return ((h % n) + n) % n;
}

/**
 * The pitcher's opening remarks, in order. Pure.
 *
 * @param deal a deal from instanceDeal()
 * @returns {string[]} one utterance per line, spoken and shown in that order
 */
export function pitchOpening(deal) {
  if (!deal) return [];
  const vars = {
    name: deal.name,
    ticker: deal.ticker,
    chain: deal.chain,
    count: deal.claims?.length ?? 0,
  };
  return PITCH_OPENING[variantOf(deal.id ?? "", PITCH_OPENING.length)].map((f) => f(vars));
}

// WHAT A COLLEAGUE SAYS WHEN THEY COME BACK.
//
// Two axes now: WHO went, and whether it was THEIR AREA. Deep lines are the
// specialist voice; shallow lines are the same person outside their lane —
// they still went, they still looked, they just can't take it very far. The
// shallow voice is what stops an off-lane send reading as a punishment: you
// get a real answer, it's simply capped, and hearing them say so out loud is
// how the depth gradient becomes legible without a tooltip.
//
// Sixteen deep lines + four shallow ones, archetype-agnostic, paid for once.
// (Four seats × dispatch/found/partial/nothing, plus one shallow each. Barron
// joined the bank on 2026-07-29 when the pitch bot took over the selling.)
const ADVISER_LINES = {
  [SEATS.MARISOL]: {
    dispatch: "Give me a second. I'll pull it.",
    found: "Here. Timestamped, and you can check it yourself.",
    partial: "Partial. That's as far as the chain goes.",
    nothing: "There's nothing to pull. No record of it anywhere.",
    shallow: "Not my area, so take this for what it is — here's what's visible from outside.",
  },
  [SEATS.GR80]: {
    dispatch: "I have read it. One moment.",
    found: "It is in the document. Section and all.",
    // "less than he does" — same category error as the tip bank; the rig is
    // rolled, so the pitcher has no gender this copy can know. See SHAPE_TIP.
    partial: "The document says less than the pitch bot does.",
    nothing: "Nothing on file. Not redacted — absent.",
    shallow: "I can read what is in front of me. On this one, that is not much.",
  },
  [SEATS.EUGENE]: {
    dispatch: "Let me see who's actually saying this.",
    found: "Found the source. And who repeated it, and when.",
    partial: "Half of it traces. The other half is just people agreeing with each other.",
    nothing: "Nobody's saying it. There's no story here to trace — that's the finding.",
    shallow: "This isn't really a story question, so all I've got is the surface.",
  },
  // BARRON, AS A SPECIALIST — new on 2026-07-29, and the only prose the pitch-bot
  // change actually required. This bank was `{}` for as long as he was the
  // pitcher: he answered in his own voice under his own name, so he never needed
  // the four retrieval lines every other seat has.
  //
  // He keeps his jargon — "tape" is characterisation in a seat's mouth, and
  // invariant 6 binds the UI, not the people. What he retrieves is the WINDOW,
  // never the price: the chart lane's whole lesson is that price movement isn't
  // evidence, so his findings are about what series exists to be looked at.
  [SEATS.BARRON]: {
    dispatch: "Hold on. Let me pull the tape.",
    found: "There. The whole window, not the slice you were shown.",
    partial: "That's as much tape as exists. It's thin, and thin is all it is.",
    nothing: "There's no series to pull. Nobody ever published one — that's the finding.",
    shallow: "This isn't a chart question. I can tell you what the price did, and price isn't evidence.",
  },
};

/**
 * @param seat   who you sent
 * @param result "found" | "partial" | "nothing" | "dispatch"
 * @param deep   was it their lane? off-lane always returns the shallow line,
 *               because the point of sending the wrong specialist is that you
 *               hear them tell you it was the wrong specialist.
 */
export function adviserLine(seat, result, deep = true) {
  const bank = ADVISER_LINES[seat];
  if (!bank) return "";
  if (!deep) return bank.shallow ?? "";
  return bank[result] ?? "";
}
