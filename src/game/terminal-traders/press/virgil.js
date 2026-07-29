// VIRGIL — the office cat, and the only voice on the floor who isn't staff.
//
// WHY HE EXISTS. The free read used to belong to Eugene, and it made him the
// one seat in four with a permanent extra power. That asymmetry was reported
// three separate times, through three different implementations:
//
//   "nothing happens when i click it"          (he was an unclickable tile)
//   "I still don't get Eugene's off-sides role" (moved beside his own line)
//   "why does eugene have the special role?"    (given the agenda, still odd)
//
// Each fix moved him. None of them worked, because the problem was never where
// he sat — it was that a colleague with an exemption needs explaining, and an
// explanation in a design doc is not an explanation at the table.
//
// Author's proposal, 2026-07-28: "one option is to have a separate character,
// like a cat, be the special friend that gives tips and advice." That dissolves
// it instead of justifying it. A cat is obviously not somebody you dispatch to
// pull chain records, so nobody clicks him expecting a press — the failure that
// started this whole thread becomes structurally impossible — and the desk goes
// back to four seats, four lanes, one use each, no exceptions.
//
// The name was already yours: fluffyCat.glb is listed as "Virgil" in the
// commented-out /vigil roster (src/app/vigil/page.js:33). Virgil is the guide
// who walks Dante through hell, which for a page about spotting frauds is not
// a name worth improving on.
//
// THE INVARIANT, and it is the same shape as the discipline rule in §5:
// VIRGIL NEVER TOUCHES THE RESOLVER. He reads run state and returns strings.
// Nothing here is imported by pressRun. The game must be fully playable and
// fully scoreable with him muted — which is exactly why muting him is offered.

import { LANES, SEATS } from "./questions.js";

// THE ROLE LINE IS THE WHOLE PITCH FOR HIM (author, 2026-07-28: "Virgil - the
// cat - your guide"). The four seats get a subject — THE TAPE, THE MONEY, THE
// PAPERWORK, THE STORY — because what you need to know about them is what they
// go deep on. He deliberately breaks that pattern: he has no subject, because
// he isn't someone you send. "Your guide" is the Dante reference paying for
// itself, and it tells a first-time player the one true thing about him — he
// is on your side, which not one other person at this desk is.
export const VIRGIL = {
  id: "virgil",
  name: "Virgil",
  role: "THE CAT · YOUR GUIDE",
  portrait: "/cameo_kitty.webp",
  model: "/models/fluffyCat.glb",   // 580KB. NOT FR80Cat.glb, which is 15MB and
                                    // would land on top of an already-heavy scene.
  blurb: "Sits on the desk. Has opinions. Cannot be sent anywhere.",
};

/**
 * What KIND of weak argument this is — the tip half, and the half you can turn
 * off. It names the shape without naming the taxonomy, and never says whether
 * the claim is true.
 *
 * THIS IS SCAFFOLDING, AND THAT IS THE POINT. As a colleague's line it was
 * either teaching or noise and there was no way to tell which. As a cat's tip
 * it is training wheels with a legible off switch — "Virgil stops chiming in"
 * is a difficulty setting in a way "turn off Eugene" never could be.
 */
const SHAPE_TIP = {
  UNSOURCED: [
    "Assertion. No origin on it.",
    "Somebody said this. He isn't saying who.",
    "That's a claim about a claim.",
  ],
  POSITIONED: [
    "He's in it. That's not nothing, it's just not evidence.",
    "Interested party. Worth remembering.",
    "He profits from you agreeing.",
  ],
  SELECTIVE_WINDOW: [
    "A number inside a window somebody chose.",
    "True over some period. Which one?",
    "That's a framing, not a fact.",
  ],
  BORROWED_CREDIBILITY: [
    "Somebody else's name is doing the work here.",
    "He's standing on a document.",
    "That's borrowed. The question is how far it reaches.",
  ],
  UNFALSIFIABLE: [
    "Nothing could count against that.",
    "Shaped so it can't be wrong.",
    "There's no version of this he'd take back.",
  ],
  SURVIVORSHIP: [
    "That's the ones that worked.",
    "Survivors only. Where are the rest?",
    "The sample picked itself.",
  ],
};

export function shapeTip(claim, salt = 0) {
  if (!claim) return "";
  const bank = SHAPE_TIP[claim.shape];
  if (!bank) return "";
  return bank[(claim.id.length + salt) % bank.length];
}

/* ---------------------------------------------------------------------- */

// The agenda's noun per lane. Singular and plural are both authored: the plural
// is not always a trailing "s" — "question about the story" pluralises on the
// HEAD noun, and appending to the phrase produced "two more question about the
// storys".
//
// CHART WAS "question about the tape" UNTIL 2026-07-28, when ticker-tape slang
// failed invariant 6 on the author (see LANE_LABEL in desk.js). It is now a
// plain compound like CHAIN and RECORD, which also drops it out of the
// head-noun case — SOCIAL is the only lane still in there, and it is the reason
// that case still needs its assertion.
const LANE_NOUN = {
  [LANES.CHAIN]: ["money question", "money questions"],
  [LANES.RECORD]: ["paperwork question", "paperwork questions"],
  [LANES.CHART]: ["chart question", "chart questions"],
  [LANES.SOCIAL]: ["question about the story", "questions about the story"],
};

const COUNT_WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
const countWord = (n) => COUNT_WORD[n] ?? String(n);

/**
 * HOW MUCH RUNWAY IS LEFT IN THIS LANE — the half that stays ON.
 *
 * This is the only information on the floor nobody else supplies, and it is
 * what turns the core decision from a coin flip into a decision: spend your one
 * specialist here, or hold them for a better claim in the same lane. Measured:
 * on backdoor-fork's first claim it reads "last one you'll get" in 2000 of 2000
 * seeds, and holding there forfeits the deal's decisive deep look.
 *
 * LEAK-FREE BY CONSTRUCTION. `remaining` comes from pressRun.laneOutlook, which
 * counts LANES ONLY — never backing, never discriminates, never the branch.
 * Lanes are public from second zero by design.
 */
export function agenda(claim, { owner = null, spent = [], remaining = 0 } = {}) {
  if (!claim) return "";

  // A claim nobody specialises in (LANES.SHAPE). The useful question moves up a
  // level: how much of the rest of this pitch can anybody go deep on?
  if (!owner) {
    return remaining === 0
      ? "Nobody's the expert on that one, and there's nothing left after it."
      : `Nobody's the expert on that one. ${countWord(remaining)} left that somebody is.`;
  }

  const [one, many] = LANE_NOUN[claim.lane] ?? ["question", "questions"];
  const noun = remaining === 1 ? one : many;

  if (spent.includes(owner.id)) {
    return remaining === 0
      ? `That was the last one, and ${owner.name} was already spent.`
      : `${countWord(remaining)} more ${noun} after this, and only shallow looks left.`;
  }
  if (remaining === 0) return `Last ${one} you'll get. Deep look now, or never.`;
  return `${countWord(remaining)} more ${noun} after this one.`;
}

/**
 * Virgil's two lines. The agenda always; the tip only while he's helping.
 * Returns them SEPARATELY — they are a resource readout and a flavour line, and
 * concatenating them into one italic sentence is what trained the eye to skip
 * the block and miss the actionable half.
 */
export function virgilRead(claim, { owner = null, spent = [], remaining = 0, tips = true } = {}) {
  return {
    agenda: agenda(claim, { owner, spent, remaining }),
    tip: tips ? shapeTip(claim) : "",
  };
}
