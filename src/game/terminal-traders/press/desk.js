// THE DESK — who sits where, and the global line banks.
//
// Everything here is ARCHETYPE-AGNOSTIC and paid for once. An archetype
// authors claims; it never authors a word for Eugene or for an adviser's
// dispatch, so adding read #3 through #13 costs nothing on this axis.
//
// ~40 lines of prose, reused forever. That is the whole point of moving the
// four-character layer here instead of into the archetypes.

import { LANES, PITCHER, SEATS, SHAPES, inLane } from "./questions.js";

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
  name: "The Agent",
  role: "PITCHING ON COMMISSION",
  model: "/models/pitch-bot.glb",   // 566KB. Draco + EXT_texture_webp required.
  portrait: "/thumbnail_johnBarron.png",  // TODO: bot portrait render
  clips: { idle: "idle", talking: "talking" },
  blurb: "Paid if you fund it. Never met the founders either.",
};

// PORTRAITS ARE DESK DATA, NOT SURFACE DATA. They used to be a `cardId` that
// each surface resolved into a Genesis card face through dealCard.js. Cards
// were cut from this game on 2026-07-28, so what a seat looks like is now just
// a path, and it belongs next to the name and the lane rather than being
// re-derived identically on two surfaces.
//
// These four are renders of the SAME models that sit in the room, against the
// same grid backdrop, so the tiles and the scene agree with each other.
export const DESK = {
  [SEATS.BARRON]: {
    id: SEATS.BARRON, agentId: "Demon", station: "demon",
    name: "John Barron", role: "THE CHART", lane: LANES.CHART,
    portrait: "/thumbnail_johnBarron.png",
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
    portrait: "/thumbnail_marisol.png",
    blurb: "Money movement, wallet ages, unlocks.",
  },
  [SEATS.GR80]: {
    id: SEATS.GR80, agentId: "Monk", station: "monk",
    name: "Saint GR80", role: "THE PAPERWORK", lane: LANES.RECORD,
    portrait: "/thumbnail_gr80.png",
    blurb: "What the documents actually say.",
  },
  [SEATS.EUGENE]: {
    id: SEATS.EUGENE, agentId: "RL80", station: "eugene",
    name: "Eugene", role: "THE STORY", lane: LANES.SOCIAL,
    portrait: "/thumbnail_eugene.png",
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
  [LANES.RECORD]: "the paperwork",
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
  if (!who) return "NOBODY HERE SPECIALISES IN THIS ONE — anyone you ask gets the shallow version";
  const label = LANE_LABEL[claim.lane].toUpperCase();
  if (spent.includes(who.id)) {
    return `THIS ONE'S ${label}, AND ${who.name.toUpperCase()} IS SPENT — anyone else gets the shallow version`;
  }
  return `THIS ONE'S ${label} — ${who.name} goes deepest on it`;
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
    partial: "The document says less than he does.",
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
