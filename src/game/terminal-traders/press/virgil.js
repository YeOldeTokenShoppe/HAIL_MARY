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

  /**
   * HIS VOICE, as a SPEAKER CODE — never a raw ElevenLabs id. This is client
   * code on both surfaces; the id and the API key stay on /api/counsel-voice,
   * which resolves "VG" itself precisely so this file can be imported into a
   * bundle without publishing an id that would bill someone else's quota.
   *
   * IT LIVES HERE FOR THE SAME REASON THE SEATS' VOICES LIVE IN desk.js: both
   * surfaces need it and neither should own it. See the VOICE IS DESK DATA note
   * there — the failure it records is a surface that hard-codes one voice and
   * then reads everybody's lines in it.
   *
   * ADDING A VOICE IS NEVER A ONE-FILE CHANGE, and two thirds of it fails
   * SILENTLY (the list is written out in full on pitchBotScene's v3 entry):
   *   api/counsel-voice VOICES      — or there is no id to synthesise with
   *   api/counsel-voice allow-list  — or "VG" is quietly served as BARRON, and
   *                                   the symptom is the wrong character
   *                                   speaking rather than any error at all
   *   lib/adviserMouth              — or setAdviserMouth drops every write and
   *                                   whatever draws his mouth never opens
   * All three are done for VG as of 2026-08-03.
   */
  voice: "VG",

  /**
   * HIS FACE, for the surfaces that host a live SitePal player rather than a
   * still — the mobile CHANNEL feed (components/trade/SitePalFeed) and the
   * desktop shared host portal, which swaps characters with loadSceneByID and
   * therefore only ever needs `sceneId`.
   *
   * SHAPED LIKE SITEPAL_PROJECTION_CONFIG's entries (CyborgTempleScene) so it
   * can be spread into that registry the day he is projected onto geometry. He
   * is NOT in it today, and that is deliberate: that registry carries `crop` and
   * `filter` for cropping a rendered head onto a mesh face, and Virgil's mesh is
   * a cat — there is no face on fluffyCat.glb to project a portrait onto.
   *
   * FROM THE ACCOUNT SNIPPET, 2026-08-03:
   *   AC_VHost_Embed(9308752,600,800,"",1,0,2775344,0,1,0,"JHWf…",0,1)
   * The 6th and 10th positionals are 0 there, as they are in every raw snippet
   * this account emits. SitePalFeed builds its own params with BOTH forced to 1
   * and ignores anything passed for them — the 10th is SitePal's `context`, which
   * their docs require to be 1 under a JS framework (see the note on
   * HOST_SITEPAL_CONFIG in app/trade/page.js). So only `account`, `sceneId` and
   * `hash` are load-bearing here; `embedContext` records the working value, not
   * the snippet's.
   */
  sitepal: {
    label: "Virgil",
    account: "9308752",
    sceneId: 2775344,
    hash: "JHWfKVZHnCkhsMxxYs0ehXiPlNlayZxW",
    embedContext: 1,
    /**
     * WHAT THE PLAYER SPEAKS WITH. Engine 14 = ElevenLabs through the
     * SitePal-connected account, where `voice` is the EL voice UUID rather than
     * one of SitePal's numbered built-ins (engine 7's "Gilbert" and friends).
     *
     * NOTE THE KEY IS `voice`, NOT `id`. SitePalFeed reads `v.voice` only;
     * counselSpeech.speakInPortal reads `voice.voice ?? voice.id`. Written this
     * way it satisfies both — COUNSEL_VOICES' `{ id }` shape works in the portal
     * and comes out SILENT in the feed, which is the kind of mismatch that reads
     * as a dead avatar rather than as a wrong field name.
     *
     * SAME HUMAN VOICE AS "VG" ABOVE, by design: he must not change voice when
     * the surface changes. That is the exact trap GR80 fell into across /main's
     * two layouts (SitePal Gilbert on one, ElevenLabs on the other) and the
     * reason COUNSEL_VOICES.GR now carries a comment about staying in lockstep.
     * If the id moves in api/counsel-voice, move it here in the same commit.
     */
    voice: { voice: "R4Zv8YQNcHyNDZl0ViUG", lang: 1, engine: 14 },
  },
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
/* NO GENDERED PRONOUN FOR THE PITCHER, ANYWHERE IN HERE (author, 2026-08-04:
   "Virgil says 'He isn't saying who' but i have a female-coded pitchbot").
   It is not a slip in one line, it is a category error: the RIG IS ROLLED, from
   PITCH_BOT_ROSTER, blind and at page load (§1 rule 6) — so any copy that
   genders the speaker is wrong for whichever bot the beam happens to cast, and
   nothing here can know which one that is. The desk settled on "it" long ago
   ("its client's deal", "ITS SCREEN STAYS BLACK", "on its screen"); this bank
   is where that rule never reached. Use "it", or name it "the pitch bot". */
const SHAPE_TIP = {
  UNSOURCED: [
    "Assertion. No origin on it.",
    "Somebody said this. The pitch bot isn't saying who.",
    "That's a claim about a claim.",
  ],
  POSITIONED: [
    /* PAID ON THE CLOSE, NOT "IN IT". The old line was "He's in it", which
       gendered the bot and also gave it a HOLDING — and a commissioned agent
       has no money in the vault. §3 files that exact confusion as content debt
       on two archetype slots; the bot's interest is the close, which is the
       version that is both true and structurally undeniable. */
    "Paid on the close. That's not nothing, it's just not evidence.",
    "Interested party. Worth remembering.",
    "It profits from you agreeing.",
  ],
  SELECTIVE_WINDOW: [
    "A number inside a window somebody chose.",
    "True over some period. Which one?",
    "That's a framing, not a fact.",
  ],
  BORROWED_CREDIBILITY: [
    "Somebody else's name is doing the work here.",
    "It's standing on a document.",
    "That's borrowed. The question is how far it reaches.",
  ],
  UNFALSIFIABLE: [
    "Nothing could count against that.",
    "Shaped so it can't be wrong.",
    "There's no version of this it'd take back.",
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
  /* EVERY AGENDA LINE NAMES THE DECISION, NOT JUST THE COUNT.
     This branch used to return the count alone — "One more question about the
     story after this one." — and the author called it pointless twice, which
     it was: it is the only one of the four that states a fact without saying
     what the fact costs you. Its three siblings all finish the thought ("Deep
     look now, or never", "only shallow looks left", "was already spent"), and
     that second clause is the entire reason §3 calls the agenda the half that
     converts the seat choice "from a coin flip into a decision".
     What this case means is the opposite of the remaining === 0 one: there IS
     another shot at this lane, so holding the specialist is not a forfeit —
     which is precisely the thing a player cannot work out from the rail. */
  return `${countWord(remaining)} more ${noun} after this one. ${owner.name} will keep, if you'd rather wait.`;
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
