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
   * FROM THE ACCOUNT SNIPPET, re-issued 2026-08-04:
   *   AC_VHost_Embed(9308752,600,800,"",1,1,2775344,0,1,0,"Pfnc…",0,1)
   * The embed id changed with it (was "JHWf…", 2026-08-03). Account, scene,
   * geometry and every other positional are unchanged.
   *
   * THE 6TH POSITIONAL CAME BACK AS 1 THIS TIME and is deliberately NOT recorded
   * as such below, because nothing here passes it: `controls` draws SitePal's
   * on-scene play overlay, which would sit on top of a face being cropped into a
   * ~104px tile. sitepal-portal.html hard-codes 0, as do CommsPanel and every
   * other embed in this repo. The 10th is 0 in every raw snippet this account
   * emits. SitePalFeed builds its own params with BOTH forced to 1
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
    hash: "PfncT5uHbOWRba2VJj430Mhincw5OXYP",
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
    voice: { voice: "2ajXGJNYBR0iNHpS4VZb", lang: 1, engine: 14 },
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
/* DRAFT 2 (2026-08-04). The old bank NAMED the shape and stopped ("Assertion.
   No origin on it."), which is a label, not a lesson — it told a player what to
   call the move without telling them what to DO about it. Every tip now names
   the weakness AND the check that would settle it, and several point at the
   seat who could run that check. The taxonomy is still never spoken. */
const SHAPE_TIP = {
  UNSOURCED: [
    "That may be true, but we still don't know where it came from. A source tells us whether the claim can be checked.",
    "The pitch bot gave us a conclusion without naming who measured it or who witnessed it.",
    "That is one person repeating a claim. We need to trace it back to someone with first-hand knowledge.",
  ],
  POSITIONED: [
    /* THE INTEREST IS THE CLOSE, NOT A HOLDING. The original line was "He's in
       it", which gendered the bot AND gave it ownership — a commissioned agent
       has no money in the vault. §3 files that as content debt on two archetype
       slots; yieldMirage's is fixed as of draft 2 (its stake slot is now a
       future commission deposit), backdoorFork's is NOT. Tips [0] and [2] below
       assume the commission framing, so they read slightly wrong against
       backdoorFork's ownership claim until that slot is brought across too. */
    "Putting commission into the vault sounds aligned, but the exit terms decide whether the risk is actually shared.",
    "The pitch bot benefits if you agree. That does not make the claim false; it means compensation is not independent evidence.",
    "Part of the fee may ride with you. Ask how long it is locked, who leaves first, and whether anyone can waive the rules.",
  ],
  SELECTIVE_WINDOW: [
    "The rate can be accurate and still be flattering. Ask which dates were included and what happened outside them.",
    "A return is always measured over a period. We need to know who chose this one, and why.",
    "That number is a frame around part of the history. Connor can tell us what sits outside the frame.",
  ],
  BORROWED_CREDIBILITY: [
    "The auditor's reputation is doing a lot of work. We need the exact question that firm was hired to answer.",
    "The claim stands on a document. GR80 can read its scope, exclusions, and findings—not just the logo.",
    "Credibility can be borrowed only as far as the review reaches. A code audit is not automatically a check of the money.",
  ],
  UNFALSIFIABLE: [
    "\"Works in every market\" leaves no possible result that could disprove it. Ask what specific signal would change the pitch bot's mind.",
    "The claim is shaped so every outcome can be explained afterward. A real test needs a failure condition set beforehand.",
    "There is no version of this claim the pitch bot has promised to take back. Eugene can look for a concrete threshold behind the story.",
  ],
  SURVIVORSHIP: [
    "Deposit growth counts the people who stayed or arrived. It says nothing about people who tried to leave.",
    "We are being shown the survivors. The useful check is how withdrawals actually settled.",
    "The sample selected itself: successful deposits remain visible as growth. Marisol can look for delayed or costly exits.",
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
      ? "Nobody owns this kind of check, and no claims come after it. Ask for a general view now or let this one pass unchecked."
      : `Nobody owns this kind of check. Specialist-owned claims still ahead: ${countWord(remaining)}. A follow-up later may get a deeper answer.`;
  }

  const [one, many] = LANE_NOUN[claim.lane] ?? ["question", "questions"];
  const noun = remaining === 1 ? one : many;

  if (spent.includes(owner.id)) {
    return remaining === 0
      ? `This is the last claim, and ${owner.name} has already taken a deep look. You can still ask someone else for a surface view.`
      : `${countWord(remaining)} more ${noun} after this, but ${owner.name} has already taken a deep look. Anyone else can only give you a surface view.`;
  }
  if (remaining === 0) return `This is your last ${one}. Ask ${owner.name} for the deep check now, or lose the chance to use that expertise.`;
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
  return `${countWord(remaining)} more ${noun} after this one. ${owner.name} can examine this claim deeply or remain available for a later one.`;
}

/**
 * Virgil's two lines. The agenda always; the tip only while he's helping.
 * Returns them SEPARATELY — they are a resource readout and a flavour line, and
 * concatenating them into one italic sentence is what trained the eye to skip
 * the block and miss the actionable half.
 */
/* ---------------------------------------------------------------------- */

/**
 * WHAT YOU CAN DO ABOUT IT — spoken after his read, once per claim.
 *
 * The tip names the weakness and then he goes quiet, which leaves a first-time
 * player looking at a lit board with no idea that any of it is clickable
 * (author, 2026-08-04: "we need Virgil to then say something like 'consult with
 * one of your teammates or press the pitchbot to say more'"). The agenda has
 * always carried the resource half in TEXT; this is the half that says the moves
 * exist at all, out loud, in the voice of the one character who is on your side.
 *
 * IT NAMES THE MOVES AND NEVER PICKS ONE. "Ask somebody" and "press it yourself"
 * are both always legal, so saying both costs nothing; saying WHICH would be the
 * cat playing the game for you, and would have to see the branch to be right.
 * Nothing in here reads the deal.
 *
 * AND IT MAY NOT INSTRUCT AN IMPOSSIBLE MOVE. Once `pressesLeft` hits zero there
 * is no follow-up to spend and the line has to say so — the desk has shipped
 * that bug twice in other copy (the lane band named a SPENT adviser as the way
 * through, and Virgil's own agenda pointed at one), and both times it was an
 * instruction the controller rejects as a no-op. See laneSentence in desk.js.
 */
const NEXT_MOVE = [
  "Ask one of your teammates to look into that, or put it to the pitch bot yourself.",
  "Send a teammate after it, or press the pitch bot — asking it is always free.",
  "One of your team can check that, or you can press the pitch bot for more.",
  "Put it to a teammate, or ask the pitch bot to say more about it.",
];

/** No follow-ups left. Says what is true instead of what is impossible. */
const NEXT_MOVE_SPENT = [
  "That's your follow-ups gone. What's on the table is what you'll decide on.",
  "No questions left. From here you're reading what you already have.",
];

/**
 * @param pressesLeft  run.pressesLeft. Zero switches to the spent bank.
 * @param index        the claim index, so the bank rotates and he cannot say the
 *                     same thing twice running — the identical rule, and the
 *                     identical bug, as pitcherAside in desk.js.
 */
export function nextMove({ pressesLeft = 0, index = 0 } = {}) {
  const bank = pressesLeft > 0 ? NEXT_MOVE : NEXT_MOVE_SPENT;
  return bank[((index % bank.length) + bank.length) % bank.length];
}

/**
 * AND WHAT TO DO ONCE THE ANSWER HAS LANDED — spoken after the finding, not
 * after the claim.
 *
 * The third place the floor went quiet on a first-time player: you spend a
 * follow-up, somebody reports back, and then nothing says the beat is over
 * (author, 2026-08-04: "I pressed pitchbot on the team. He gave a mildly
 * concerning answer. Next, Virgil should advise again what to do next"). The
 * claim-time nudge names the moves you have; this one names the move that ENDS
 * the exchange, which is a different sentence and a different moment.
 *
 * IT NEVER CHARACTERISES WHAT CAME BACK. Not "that's concerning", not "that's
 * clean" — the whole game is the player judging the finding, and a guide who
 * grades it first has answered the question for them. Worse, it would have to
 * see the outcome to be right, and `discriminates` is autopsy-only. So this is
 * purely "the beat is done, here is the control", and an assertion pins that it
 * carries no verdict language.
 *
 * IT NAMES THE BUTTON THAT IS ACTUALLY THERE. On the last claim the nav shows
 * CALL IT rather than NEXT POINT, so pointing at NEXT POINT would be the
 * impossible-instruction bug again, one claim from the end.
 */
const AFTER_ANSWER = [
  "That's what came back. Press NEXT POINT when you've finished with it.",
  "Sit with that, then press NEXT POINT for the next one.",
  "When you're done with that, NEXT POINT moves it along.",
];

const AFTER_ANSWER_LAST = [
  "That's the last of them. When you're ready, call it.",
  "No more points coming. Make your call when you've thought about it.",
];

/**
 * @param lastClaim  the nav is showing CALL IT, not NEXT POINT.
 * @param index      claim index, so it rotates and cannot repeat back to back.
 */
export function afterAnswer({ lastClaim = false, index = 0 } = {}) {
  const bank = lastClaim ? AFTER_ANSWER_LAST : AFTER_ANSWER;
  return bank[((index % bank.length) + bank.length) % bank.length];
}

/**
 * Virgil's lines. The agenda always; the tip and the nudge only while he's
 * helping. Returned SEPARATELY — see the note above on why the agenda and the
 * tip are not one sentence, and the nudge is a third job again: it is neither a
 * resource readout nor a read of the claim, it is the controls.
 *
 * `nextMove` IS GATED ON `tips` like the tip is. The design's phrasing for the
 * switch is "Virgil stops chiming in", and a muted cat who still talks you
 * through the controls six times a session is the broken-toggle reading that
 * note exists to prevent. The AGENDA text is the half that never turns off.
 */
export function virgilRead(claim, { owner = null, spent = [], remaining = 0, tips = true,
                                    pressesLeft = null, index = 0,
                                    answered = false, lastClaim = false } = {}) {
  return {
    agenda: agenda(claim, { owner, spent, remaining }),
    tip: tips ? shapeTip(claim) : "",
    /* ONE SLOT, TWO SENTENCES, CHOSEN BY WHETHER THE CLAIM HAS BEEN ANSWERED.
       Before: the moves you have. After: the move that ends the beat.
       IT HAS TO SWITCH. A claim takes one press, so once you have spent it
       "ask a teammate, or put it to the pitch bot" is an instruction for a move
       the controller now rejects — left on screen it is the third instance of
       the bug the lane band and the agenda both shipped, and the only one that
       is wrong the entire time the answer is being read.
       The SPOKEN afterAnswer line fires from the surfaces at the instant the
       finding lands; this is the same sentence persisting on the panel. */
    // null pressesLeft = a caller that has not opted in (tests, older surfaces).
    nextMove: !tips || pressesLeft == null ? ""
      : answered ? afterAnswer({ lastClaim, index })
        : nextMove({ pressesLeft, index }),
  };
}

/* ---------------------------------------------------------------------- */

/**
 * THE FIRST-RUN BRIEFING — new in draft 2 (2026-08-04).
 *
 * Plays ONCE, before the pitch bot's opening, and is replayable from the help
 * control. Virgil owns it for the same reason he owns the tips: he is the only
 * voice on the floor who is on the player's side, so he is the only one who can
 * explain the rules without it reading as either an instruction manual or a
 * character breaking role.
 *
 * WHAT IT MAY SAY: the objective, who the specialists are, the follow-up budget,
 * the one-deep-check-each rule, and what the final control does. All five are
 * facts about the GAME.
 *
 * WHAT IT MAY NOT SAY: anything about this deal. It is authored blind and is
 * rendered before a deal exists, so there is nothing here to leak — and the
 * charm-and-nerves line exists to close the one inference the rest of the
 * briefing could accidentally invite, which is that the bot's manner is
 * evidence. It isn't: composure is a function of the pressure band, which
 * cannot see the branch.
 *
 * THE SEAT NAMES ARE WRITTEN OUT rather than templated from DESK. They are the
 * short, friendly forms ("Marisol", "GR80") where DESK carries the full titles
 * ("Detective Marisol", "Saint GR80"), and importing desk.js here to then not
 * use its strings would buy a module edge for nothing. If a seat is ever
 * renamed, line 3 is the line to update.
 */
export const BRIEFING = [
  // HE SAYS WHO HE IS FIRST. The briefing used to open on the objective, so an
  // unnamed animal explained the rules for a minute before the tile below him
  // got round to captioning it. "Your guide" is doing the same work here as it
  // does in his role line — it is the Dante reference paying for itself, and it
  // tells a first-time player the one true thing about him: he is on your side,
  // which nobody else at this desk is. The rest earns the advice that follows —
  // he is worth listening to because he has watched this happen before.
  "I'm Virgil, your guide. I sit on this desk all day and watch every pitch that comes through it, so I know how they work.",
  "That pitch bot wants you to back a crypto project. Your job is to decide whether its case holds up.",
  "You'll hear six claims. After any three of them, you may ask a follow-up and have one teammate examine the claim more closely.",
  "Connor checks charts. Marisol follows money. GR80 reads documents and reputations. Eugene traces the story and the people telling it.",
  "Ask the matching specialist for the deepest check. Anyone can offer a quick outside view, but each teammate can only do one deep check.",
  "At the end, use the scale to back the project, bet against its case, or pass. The farther you move it, the more you can win or lose.",
  "Don't judge the pitch bot by charm or nerves. Those can mislead you. Judge the evidence your team can actually find.",
  // THE HAND-OFF. The briefing used to end on the line above and the gate button
  // simply appeared, which is the same beat-ends-on-a-jolt problem PITCH_OPENING's
  // third line exists to solve (see desk.js: it "can't be CUT, or the disclosure
  // runs straight into claim 1 with no hand-off"). Virgil finishes by handing you
  // the control, so the button is something he offered rather than something that
  // materialised. Not in BRIEFING_SHORT: a returning player already knows to click.
  // NAMES THE BUTTON IT MEANS. "Click the button" was ambiguous on a screen with
  // a dozen of them; this quotes the gate's own label, so the sentence and the
  // control identify each other. If beginLabel changes, change this with it.
  //
  // NO "BELOW ME" / "ABOVE ME". A draft said "just below me" and was wrong on
  // the surface it shipped to — the gate sits at the foot of the reading column
  // and his tile is under it, so the button is ABOVE him on desktop. The flat
  // surface stacks differently again. Copy that points at a position has to be
  // right on every layout, and this one only has to name the control.
  "When you're ready, press BRING IN THE PITCH BOT, and we'll begin.",
];

/** The returning player's version — same contract, one breath. */
export const BRIEFING_SHORT =
  "Six claims, three follow-ups, one deep check per specialist. "
  + "Then back the case, call against it, or pass. Evidence beats vibes.";

/**
 * @param short  true for the one-line version (a replay from the help control
 *               on a player who has already sat through the long one).
 * @returns {string[]} one utterance per line, spoken and shown in that order —
 *               the same shape `pitchOpening` returns, so a surface can drive
 *               both beats through one code path.
 */
export function briefing(short = false) {
  return short ? [BRIEFING_SHORT] : [...BRIEFING];
}
