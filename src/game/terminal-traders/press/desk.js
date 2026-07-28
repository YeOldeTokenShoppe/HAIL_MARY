// THE DESK — who sits where, and the global line banks.
//
// Everything here is ARCHETYPE-AGNOSTIC and paid for once. An archetype
// authors claims; it never authors a word for Eugene or for an adviser's
// dispatch, so adding read #3 through #13 costs nothing on this axis.
//
// ~40 lines of prose, reused forever. That is the whole point of moving the
// four-character layer here instead of into the archetypes.

import { LANES, SEATS, SHAPES, inLane } from "./questions.js";

export const DESK = {
  [SEATS.BARRON]: {
    id: SEATS.BARRON, agentId: "Demon", station: "demon",
    name: "John Barron", role: "THE TAPE", lane: LANES.CHART,
    blurb: "Price, windows, momentum. Brought the deal in — gets paid if you fund it.",
  },
  [SEATS.MARISOL]: {
    id: SEATS.MARISOL, agentId: "Detective", station: "marisol",
    name: "Detective Marisol", role: "THE MONEY", lane: LANES.CHAIN,
    blurb: "Money movement, wallet ages, unlocks.",
  },
  [SEATS.GR80]: {
    id: SEATS.GR80, agentId: "Monk", station: "monk",
    name: "Saint GR80", role: "THE PAPERWORK", lane: LANES.RECORD,
    blurb: "What the documents actually say.",
  },
  [SEATS.EUGENE]: {
    id: SEATS.EUGENE, agentId: "RL80", station: "eugene",
    name: "Eugene", role: "THE STORY", lane: LANES.SOCIAL,
    blurb: "Narrative, reputation, who vouches for whom.",
  },
};

/**
 * Eugene is now a full seat (SOCIAL) rather than a fixture. Kept as a named
 * export because a lot of code refers to him directly, and because he is still
 * the one seat that does TWO things:
 *
 *   RECOGNITION — free, unlimited, every claim: the shape, then the agenda.
 *                 Costs nothing because nothing is fetched.
 *   RETRIEVAL   — one use, like the others: sent at a SOCIAL claim he comes
 *                 back with who actually vouches for whom, and stamps it on
 *                 his own board (__screen4Canvas, which existed unused all along).
 *
 * That split is the answer to "why does Eugene have the special role" — the
 * others retrieve, he also recognises, and recognition is free by nature.
 */
export const EUGENE = DESK[SEATS.EUGENE];

/**
 * What a lane is CALLED on screen. The enum is CHAIN / RECORD / CHART / SOCIAL
 * in code, but "RECORD QUESTION" reads as an instruction to record something —
 * noun or verb, you can't tell ("is 'Record' a verb or noun here?" — author,
 * 2026-07-27). Player-facing copy uses a plain noun phrase.
 */
export const LANE_LABEL = {
  [LANES.CHAIN]: "the money",
  [LANES.RECORD]: "the paperwork",
  [LANES.CHART]: "the tape",
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
  if (!who) return "NOBODY HERE SPECIALISES IN THIS ONE — anyone you send gets the shallow version";
  const label = LANE_LABEL[claim.lane].toUpperCase();
  if (spent.includes(who.id)) {
    return `THIS ONE'S ${label}, AND ${who.name.toUpperCase()} IS SPENT — anyone else gets the shallow version`;
  }
  return `THIS ONE'S ${label} — ${who.name} goes deepest on it`;
}

// What KIND of weakness this claim would have, if it has one. Never states
// whether it does — that would name the outcome before the reveal.
const SHAPE_READ = {
  [SHAPES.UNSOURCED]: [
    "Assertion. No origin on it.",
    "Somebody said this. He isn't saying who.",
    "That's a claim about a claim.",
  ],
  [SHAPES.POSITIONED]: [
    "He's in it. That's not nothing, it's just not evidence.",
    "Interested party. Worth remembering.",
    "He profits from you agreeing.",
  ],
  [SHAPES.SELECTIVE_WINDOW]: [
    "A number inside a window somebody chose.",
    "True over some period. Which one?",
    "That's a framing, not a fact.",
  ],
  [SHAPES.BORROWED_CREDIBILITY]: [
    "Somebody else's name is doing the work here.",
    "He's standing on a document.",
    "That's borrowed. The question is how far it reaches.",
  ],
  [SHAPES.UNFALSIFIABLE]: [
    "Nothing could count against that.",
    "Shaped so it can't be wrong.",
    "There's no version of this he'd take back.",
  ],
  [SHAPES.SURVIVORSHIP]: [
    "That's the ones that worked.",
    "Survivors only. Where are the rest?",
    "The sample picked itself.",
  ],
};

// EUGENE'S SECOND SENTENCE IS THE AGENDA, NOT THE LANE.
//
// It used to be a LANE_READ bank — "That one's onchain. Marisol can settle it."
// — which is word for word what the colour-coded band directly above him
// already says. Half his output restated the UI and the other half was an
// adjective, so he read as a character with no job: *"I still don't get
// Eugene's off-sides role"* (author, 2026-07-27), the third complaint about him
// in a day. Moving him twice never had a chance of fixing that.
//
// Now he reports HOW MUCH RUNWAY IS LEFT IN THIS LANE, which nothing else on
// the floor knows and which changes the decision the game is actually about:
// spend Marisol on this money question, or hold her for a better one. "Last
// one you'll get" and "three more coming" are different games.
// SINGULAR AND PLURAL ARE BOTH AUTHORED, because the plural is not always a
// trailing "s": "question about the tape" pluralises on the HEAD noun, and
// appending to the phrase produced "two more question about the tapes". Latent
// under today's archetypes — CHART and SOCIAL never reach remaining >= 2 — so
// it would have shipped silently the day a third social slot landed.
const LANE_NOUN = {
  [LANES.CHAIN]: ["money question", "money questions"],
  [LANES.RECORD]: ["paperwork question", "paperwork questions"],
  [LANES.CHART]: ["question about the tape", "questions about the tape"],
  [LANES.SOCIAL]: ["question about the story", "questions about the story"],
};

const COUNT_WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
const countWord = (n) => COUNT_WORD[n] ?? String(n);

/**
 * What's still coming, in Eugene's voice. Pure in (claim, spent, remaining) —
 * `remaining` comes from pressRun.laneOutlook, which counts LANES ONLY and so
 * cannot leak the branch.
 */
export function eugeneAgenda(claim, { spent = [], remaining = 0 } = {}) {
  const owner = laneOwner(claim);

  // A claim nobody specialises in (LANES.SHAPE — unused by today's archetypes,
  // retained for future ones). Everyone answers it shallowly or not at all.
  if (!owner) {
    if (remaining === 0) return "Nobody's the expert on that one, and there's nothing left after it.";
    return `Nobody's the expert on that one. ${countWord(remaining)} left that somebody is.`;
  }

  const [one, many] = LANE_NOUN[claim.lane];
  const noun = remaining === 1 ? one : many;

  // BUG 2 — Eugene owns SOCIAL, so on his own lane he is talking about himself,
  // and the third-person template produced "That was the last one, and me was
  // already spent." It shipped, in 192 of 400 yield-mirage seeds. The half-done
  // `${self ? "was" : "was"}` ternary left behind here was the tell: the
  // self-reference case was started and abandoned. First person, properly.
  const self = owner.id === SEATS.EUGENE;

  // The specialist for this lane is already spent. Anyone else you send still
  // ANSWERS — they just answer shallowly — so this is a loss of depth, not a
  // dead end, and the copy has to say that or it's the old lie in a new place.
  if (spent.includes(owner.id)) {
    if (remaining === 0) {
      return self
        ? "That was the last one, and you'd already sent me."
        : `That was the last one, and ${owner.name} was already spent.`;
    }
    return `${countWord(remaining)} more ${noun} after this, and only shallow looks left.`;
  }

  if (remaining === 0) {
    return self
      ? `Last ${one} you'll get. Send me now, or don't.`
      : `Last ${one} you'll get. Deep look now, or never.`;
  }
  return `${countWord(remaining)} more ${noun} after this one.`;
}

/**
 * Eugene's free read: the SHAPE of the claim, then the agenda. Deterministic in
 * the claim so a replay is identical. `spent` and `remaining` come from the run
 * — see laneSentence for why state has to be threaded rather than assumed.
 */
export function eugeneRead(claim, { spent = [], remaining = 0, salt = 0 } = {}) {
  if (!claim) return "";
  const shape = SHAPE_READ[claim.shape] || ["Hm."];
  const pick = shape[(claim.id.length + salt) % shape.length];
  return `${pick} ${eugeneAgenda(claim, { spent, remaining })}`.trim();
}

// HOW HE CARRIES IT AFTER YOU'VE HAD A GO AT HIM.
//
// Delivered as an ASIDE before his next claim, so the pitch visibly changes
// shape as the room turns on him. Eighteen lines, archetype-agnostic, paid for
// once — a new archetype adds none. None of them names a fact, an outcome or a
// lane; they are posture only, so no line here can ever carry information the
// pressure score didn't already give you.
//
// He never apologises and never concedes. A salesman who folds is a different
// character, and a much less interesting one to have to read.
const BARRON_ASIDE = {
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
    "Everyone at this table has shipped something. Let's not pretend that's nothing.",
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
export function barronAside(band, claim, index = 0) {
  const bank = BARRON_ASIDE[band];
  if (!bank || !claim) return "";
  return bank[((index % bank.length) + bank.length) % bank.length];
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
  // Barron answers in his own voice, never in this bank — the answer panel puts
  // his line under his own name. He's here only so a lookup can't come back
  // undefined if a caller asks.
  [SEATS.BARRON]: {},
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
