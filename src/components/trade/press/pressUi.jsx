"use client";
import React from "react";
import { BACKING, PITCHER, SEATS } from "@/game/terminal-traders/press/questions";
import { DESK, PITCH_BOT, laneOwner, laneSentence, seatMeta } from "@/game/terminal-traders/press/desk";
import { VIRGIL } from "@/game/terminal-traders/press/virgil";
import { pressPrice } from "@/game/terminal-traders/press/pressRun";

/*
 * SHARED FLOOR UI — the reading column and the dock, authored once.
 *
 * WHY THIS EXISTS. PressSession (desktop, in-scene) and PressFlat (mobile /
 * ?flat=1, CRT) share a pure controller but had two hand-written copies of the
 * same floor. Every desktop bug in the four-seat migration came from porting a
 * MECHANIC without porting the STATE GATING that made it work on the other
 * surface:
 *
 *   • the deck + CTA row swallowed, so the briefing had nothing to press
 *   • claim and answer anchored at the same `bottom`, so they overlapped
 *   • the seat row left ungated, so once a claim was answered every real
 *     control greyed out and the one deliberately-unclickable tile (the cat)
 *     became the brightest thing on screen
 *   • `canPress` defined on one surface and referenced on both
 *
 * Four bugs, one cause. What moved here is exactly what drifted: the gate, the
 * claim body, the answer body, the seat row, the meter and the nav.
 *
 * WHAT DELIBERATELY DID NOT MOVE. The two surfaces are not the same layout and
 * should not pretend to be — desktop is an absolutely-positioned reading column
 * over a live 3D room; mobile is one scroll region above a pinned dock. Each
 * surface keeps its own containers and positioning CSS and composes these pieces
 * inside. If you add a prop here that only one caller ever passes, check first
 * whether it belongs in that caller's container instead.
 *
 * WHAT STOPPED BEING A SURFACE DIFFERENCE. The deferred reveal — the board
 * changing only when the room stops talking, and nothing naming the outcome
 * until you have gone and looked — was mobile-only, on the reasoning that
 * desktop could show you the monitor in the room instead. It is BOTH surfaces
 * since 2026-08-02, together with the choice that replaced the automatic
 * pitcher reaction (see AnswerBody). "I want the same experience on mobile and
 * desktop" (author) — and a beat that exists on one surface only is how the two
 * drifted apart the first time.
 *
 * Class names are `pu-*` and shared; PRESS_UI_CSS styles them once.
 */

/** The one definition of "is an interruption legal right now". */
export function canPress(run, claim) {
  return run.pressesLeft > 0 && !!claim && !run.outcomes[claim.id];
}

/**
 * HOW LONG A LINE MUST STAY UP IF NOBODY SAYS IT.
 *
 * VOICE IS ENRICHMENT AND NEVER A GATE — that rule is all over both surfaces —
 * which means every beat timed off audio needs a floor for the case where audio
 * never arrives. With no API key speakAdviserLine resolves in milliseconds, so
 * the opening's three sentences would otherwise flash past in under a second and
 * land the player in claim 1 having read nothing.
 *
 * ~14 chars/second is a deliberately slow read (~170wpm on prose of this
 * length), because this is being LISTENED to when it works and the silent case
 * should not feel like a different beat. Clamped so a short line still registers
 * and a long one can't stall the floor. Shared so the two surfaces cannot drift.
 */
export function readDwellMs(text = "") {
  return Math.min(7000, Math.max(1600, Math.round(String(text).length * 72)));
}

/**
 * THE BEAT BEFORE THE CAT SPEAKS.
 *
 * Held silent between the pitch bot finishing a claim and Virgil's read of it —
 * "Virgil starts speaking too quickly after pitchbot ends" (author, 2026-08-04).
 * Coming in on the last syllable made him sound like he was talking over the bot;
 * the pause is what turns the same two lines into somebody having LISTENED and
 * then answered, which is the whole difference between a heckler and an adviser.
 *
 * NOT A DWELL. `readDwellMs` and a part's `minMs` pad the END of a line so it can
 * be read; this is dead air BEFORE one, and it is the only thing on either
 * surface that deliberately plays nothing. Consumed as a part's `leadMs`.
 *
 * Shared so the two surfaces cannot drift: one exchange, one tempo, on both.
 */
export const VIRGIL_BEAT_MS = 2400;

/**
 * THE OPENING REMARKS — the beat between HEAR THE PITCH and claim 1.
 *
 * Lines arrive ONE AT A TIME, as each is spoken, and that is the whole point:
 * printed all at once this is a paragraph the player skims and the voice then
 * reads at them, which is the "already mid-pitch" complaint in a different
 * costume. Revealed in step with the audio it is someone talking.
 *
 * `at` is the index of the line currently being said; everything before it stays
 * on screen so the thesis line (see PITCH_OPENING in desk.js) is still readable
 * when the last line lands. -1 means nothing has started yet.
 *
 * NO INTERRUPT CONTROLS HERE. There is nothing to press yet — the bot has made no
 * claim — and offering a seat row against an opening would spend an analyst on a
 * greeting. The only control is the one that skips it.
 *
 * @param onSkip cut to the first claim. Impatience is a legitimate input on this
 *               surface as much as on the arrival — see skipRoll.
 * @param onBegin THE GATE. Non-null once the remarks have finished, and while it
 *               is up nothing is playing: the opening no longer runs on into the
 *               first claim on its own (author, 2026-08-04). Introductions and
 *               selling are two different things to be doing, and the seam between
 *               them was the one place the floor never stopped for you — the bot
 *               said who it was and was three sentences into an argument before
 *               you had decided to hear one. Handing the floor back is a move the
 *               player makes, which is also what every other beat in this game
 *               does (LET PITCHBOT RESPOND, NEXT POINT).
 *
 *               It buys a second thing for free: the first claim's audio now
 *               starts inside a click, so no autoplay policy can swallow it.
 */
/**
 * TWO BEATS, ONE COMPONENT (2026-08-04). This renders the pitch bot's opening
 * remarks AND Virgil's first-run briefing, because they are the same shape — a
 * fixed list of lines revealed in step with a voice, a skip while it plays, a
 * gate when it stops — and forking it would guarantee the two drift on the
 * reveal animation, the skip semantics or the gate wording.
 *
 * Everything that differs between them is a prop with a pitch-bot default, so
 * the existing call sites did not have to change:
 *
 * @param who        speaker label. Defaults to the pitch bot.
 * @param kicker     the dim half of the header ("— opening remarks").
 * @param skipLabel  text on the skip button.
 * @param beginLabel text on the gate button.
 * @param quoted     wrap each line in quotation marks. TRUE for the pitch, which
 *                   is somebody selling you something and reads as reported
 *                   speech; FALSE for Virgil, who is talking TO you rather than
 *                   being quoted at you, and whose lines are house rules.
 */
export function OpeningBody({ lines = [], at = -1, onSkip = null, onBegin = null,
                              done = false, who = null, kicker = "— opening remarks",
                              skipLabel = "SKIP INTRO ▸",
                              beginLabel = "◉ LET PITCHBOT MAKE ITS CASE ▸",
                              cue = "▼ YOUR MOVE — PRESS TO CONTINUE",
                              quoted = true, subtitle = false }) {
  if (!lines.length) return null;
  const shown = done ? lines.length : Math.max(0, at + 1);
  return (
    <div className="pu-claim pu-opening" data-mood="cool">
      <div className="pu-who">
        {(who ?? PITCH_BOT.name).toUpperCase()} <span className="pu-dim">{kicker}</span>
        {/* SKIP AND THE GATE ARE NEVER BOTH UP. Once the remarks are done there
            is nothing left to skip, and two buttons that do the same thing at
            the same moment is a choice the player has to read to discover is
            not one. The surfaces pass null for whichever is spent. */}
        {onSkip && !onBegin && (
          <button type="button" className="pu-skip" onClick={onSkip}>
            {skipLabel}
          </button>
        )}
      </div>
      {/* SUBTITLE MODE: the line he is ON, not every line he has said.
          The accumulating transcript is right for the bot's three-line opening
          and wrong for an eight-line briefing delivered over a big talking head
          — the block grew taller than the viewport and drove itself up into the
          wordmark. It is also the wrong READING of the beat: he is guiding by
          voice, so the text is a subtitle under a face, not a document.
          It lands the instruction for free — the last line stays on screen with
          the gate, so what you are looking at when the button appears is the
          sentence telling you to press it. */}
      {(subtitle ? lines.slice(Math.max(0, shown - 1), shown) : lines.slice(0, shown))
        .map((line, i, arr) => {
          // Keyed by the line's REAL index, so subtitle mode swaps the node on
          // every part and re-fires the entrance animation instead of mutating
          // one div's text in place.
          const realIndex = subtitle ? shown - arr.length + i : i;
          return (
            <div key={realIndex}
                 className={`pu-open-line${realIndex === shown - 1 ? " now" : ""}`}>
              {quoted ? `“${line}”` : line}
            </div>
          );
        })}
      {/* THE GATE HAS TO WIN A BUSY SCREEN (author, 2026-08-04: "the scene and
          page are busy and i want to make sure the player understands what to do
          after Virgil speaks"). Saying "click the button" in the briefing was not
          enough on its own, and it was never going to be: the instruction was a
          10px line of dialogue and the thing it pointed at was a 10px translucent
          bar, both losing to a lit 3D room. Copy cannot fix an affordance.

          So the gate gets its own treatment rather than wearing the answer
          buttons' — a gold cue line naming it as YOUR move (gold is already this
          UI's "primary control" colour; see .pu-seats-h), a louder fill, and a
          slow pulse that stops for prefers-reduced-motion. It is the only thing
          on screen that is animating when it is up, which is the actual signal. */}
      {onBegin && (
        <div className="pu-choice pu-gate">
          <span className="pu-gate-cue">{cue}</span>
          <button type="button" className="pu-choice-btn hear gate" onClick={onBegin}>
            {beginLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** What actually landed, in one line. It names WHOSE board the receipt is
 *  sitting on, which is the whole point of having sent somebody. */
export function answerNote(flash) {
  if (!flash) return "";
  if (flash.nothingOnFile) {
    return `⊘ NOTHING ON FILE — ${seatMeta(flash.seat)?.name ?? "they"} looked. There is no record.`;
  }
  if (flash.backing === BACKING.VIBES) return "▚ ITS SCREEN STAYS BLACK.";
  if (flash.backing === BACKING.SOFT) return "◍ PARTIAL — some of it landed.";
  const whose = flash.board === PITCHER ? "its" : `${seatMeta(flash.board)?.name}'s`;
  return `◼ ON RECORD — on ${whose} screen, and it stays there.`;
}

/* ---------------------------------------------------------------------- */
/* the reading column                                                      */
/* ---------------------------------------------------------------------- */

/**
 * The claim: who's talking, how he's holding up, the spin, the fact under it,
 * whose specialism it is, and Virgil's read. `count` is optional ("3 / 6")
 * — mobile shows it because there's no progress rail there.
 */
/**
 * @param showVirgil  whether his read is part of this block. FALSE on a surface
 *   that renders <VirgilRead> itself — PressSession pins it under the reading
 *   column with his live feed, because the tile cannot live inside a scroller and
 *   his words should not live a screen away from his face. The flat surface keeps
 *   it inline, which is why this is a prop rather than a deletion.
 */
export function ClaimBody({ claim, virgil = null, onToggleTips = null, spent = [], count = null,
                           pressure = null, aside = "", showVirgil = true, reveal = 2,
                           remaining = 0, earlier = 0 }) {
  if (!claim) return null;
  const owner = laneOwner(claim);
  const stale = !!owner && spent.includes(owner.id);
  const band = pressure?.band || "cool";
  return (
    <div className="pu-claim" data-mood={band}>
      <div className="pu-who">
        {PITCH_BOT.name.toUpperCase()} <span className="pu-dim">— its client's deal</span>
        {band !== "cool" && (
          <span className={`pu-mood ${band}`}>
            {band === "cornered" ? "CORNERED" : band === "rattled" ? "RATTLED" : "UNBOTHERED"}
          </span>
        )}
        {count && <span className="pu-count">{count}</span>}
      </div>

      {/* HE REACTS BEFORE HE CONTINUES. The aside is posture, never fact — it
          is derived from outcomes you have already seen, so it can't tell you
          anything you didn't earn. It's what gives the session an arc: the
          sixth claim should not be delivered like the first. */}
      {aside && <div className="pu-aside">“{aside}”</div>}

      {/* THE CLAIM IS NOW SUBJECT → FACT → SPIN, and it used to be spin → fact
          with no subject at all (2026-08-04: "there is no context to this
          claim"). Two bugs, one symptom.

          THE SUBJECT WAS AUTHORED ALL ALONG and thrown away. Every slot carries
          one — THE TEAM, WHERE IT COMES FROM, THE HEADLINE — and neither surface
          rendered it; its only consumer was stampNothing on an evidence board.
          So the heading that says what the next two lines are ABOUT existed, was
          maintained, and was invisible.

          AND THE INFERENCE CAME BEFORE ITS EVIDENCE. Spins are deictic by
          construction — "THESE are real people", "THAT kind of consistency",
          "Net of fees, THAT is a compelling return" — so printing the spin first
          hands the player a pronoun with no antecedent and supplies the referent
          on the line below. That is backwards from the game's own thesis (§1:
          every fact is true, "what you judge is the inference sold on top of
          it"): the fact is the floor, the spin is what gets built on it, and the
          eye has to meet them in that order for the judgement to be available at
          all. Reordering fixes every archetype at once and cost no prose — the
          lines that read as context-free were the right lines in the wrong
          order. */}
      <div className="pu-subject">{claim.subject}</div>
      {/* THE LEAD — normal deck framing, so the point is introduced before it is
          argued (author, 2026-08-04: "there should be some normal opening line
          ... followed by the specifics"). It is the seller's voice but it is not
          the SPIN: it says what this point is about and claims nothing, which is
          what lets the fact underneath land as evidence rather than as a fragment.
          Slot-level, so it cannot differ between branches. */}
      {claim.lead && <div className="pu-lead">“{claim.lead}”</div>}
      <div className="pu-fact"><span className="pu-tag">FACT</span> {claim.fact}</div>
      <div className="pu-spin">“{claim.spin}”</div>

      {/* THE LANE BAND'S OWN BOX IS GONE (author, 2026-08-04: "a stray box with
          this text... maybe Virgil should speak this part"). It was a
          colour-coded panel saying who goes deepest, sitting directly on top of
          a cat panel whose job is also to tell you who to spend and when — two
          boxes, one question, which is exactly the density the column was
          drowning in. The sentence moved into Virgil's block below and is now
          the FIRST thing he says. See laneSentence in desk.js for what survived
          the move: the spent branch (invariant 8) and the rule that his tip may
          never restate it. */}

      {/* VIRGIL — the office cat, and the only voice here who isn't staff.
          The free read used to be Eugene's, which made him the one seat in four
          with a permanent extra power; that asymmetry was reported three times
          through three different implementations. Moving it onto a character
          who is obviously not a colleague dissolves it instead of justifying
          it, and gives the tips an off switch that reads as a difficulty
          setting rather than as disabling a co-worker.

          TWO LINES, NOT ONE SENTENCE. The agenda is a resource readout and the
          tip is flavour; concatenated they trained the eye to skip the block,
          and the actionable half was the one being skipped. Agenda first and
          brighter, and it is the half that never turns off.

          THE SWITCH ALSO SILENCES HIM as of 2026-08-03, when he got a voice and
          started speaking the agenda aloud on both surfaces. The agenda TEXT is
          still the half that never turns off — what the switch now costs you is
          the tip and the talking. That is the design's own phrasing for it
          ("Virgil stops chiming in"), and it is the only reading that survives
          him having a throat: a cat you have muted who carries on talking six
          times a session reads as a broken toggle, not as a difficulty setting. */}
      {showVirgil && (
        <VirgilRead claim={claim} virgil={virgil} spent={spent} onToggleTips={onToggleTips}
                    reveal={reveal} remaining={remaining} earlier={earlier} />
      )}
    </div>
  );
}

/**
 * VIRGIL'S READ, AS ITS OWN BLOCK — extracted from ClaimBody on 2026-08-04 so a
 * surface can put it somewhere other than inside the claim.
 *
 * PressSession needs exactly that. Its live SitePal tile cannot go inside the
 * reading column's scroller (an overflow-clipped subframe is a throttled one),
 * so the tile is pinned below the scroller — and leaving his WORDS up inside the
 * claim block left the column reading VIRGIL / PITCH BOT / VIRGIL, with his face
 * and his sentence separated by the argument they are about (author, 2026-08-04).
 * Rendered here, the surface can pin face and words together as one panel.
 *
 * ONE COPY OF THE MARKUP, still. The flat surface calls it through ClaimBody
 * exactly as before and cannot tell the difference; keeping a second copy is what
 * let the two presentations drift apart the last time.
 *
 * @param portrait  render the 34px still. FALSE when the surface is supplying its
 *                  own face — PressSession puts a lip-syncing player where this
 *                  image would be, and two of the same cat is what the live tile
 *                  was added to remove.
 * @param status    "LIVE" / "ON AIR" beside his name, for a surface that is
 *                  showing a feed and so has a state to report. `statusOn` lights
 *                  it. Omitted everywhere else — the flat surface has no tile and
 *                  a status readout on a still is a lie.
 */
/**
 * @param onReplayBrief  re-run the first-run briefing. Null hides the control.
 *   THE SURFACES ONLY PASS IT BEFORE THE PITCH HAS THE FLOOR, and that is a
 *   deliberate limit rather than an oversight: the briefing renders in the
 *   opening column, which claim 1 takes over for the rest of the session, so a
 *   replay from claim 4 would speak six lines of house rules over the claim you
 *   were reading with nowhere to print them. Wiring it mid-session means giving
 *   it a surface of its own — worth doing, not free.
 */
/**
 * `reveal` — HOW MUCH OF HIM HAS ACTUALLY BEEN SAID YET (author, 2026-08-05:
 * "i don't want to show all that text until he speaks it", and the note it came
 * attached to: "too much text all stacked up, different sources, different
 * colors and sizes — this would be overload for most players").
 *
 * His block used to print in full the moment the claim changed, so all four of
 * his lines sat on screen through the bot's three utterances with nothing
 * driving them. On the desktop column that put the cat's read — pink lane line,
 * bold tip, grey agenda, gold next-move — under a claim the bot had not finished
 * making, which is most of the stacking the report is about.
 *
 * 0 = nothing of his yet, 1 = his read (the lane line and the tip), 2 = the
 * consequence (the agenda and what to do next). The levels are set by the claim
 * turn's own `onPart`, so the text arrives exactly when the voice does and the
 * silent case still resolves: with no audio the dwell floors advance the parts
 * anyway, so the lines appear on the same schedule, just faster.
 *
 * Defaults to 2 so any caller that does not thread it through — and the
 * post-claim states, where he has long since spoken — behaves as before.
 */
export function VirgilRead({ claim, virgil = null, onToggleTips = null, spent = [],
                             portrait = true, status = null, statusOn = false,
                             onReplayBrief = null, reveal = 2, remaining = 0, earlier = 0 }) {
  if (!claim && !virgil?.agenda && !virgil?.tip) return null;
  if (!claim) return null;
  // Nothing of his has been said yet — the bot still has the floor.
  if (reveal < 1) return null;
  const owner = laneOwner(claim);
  const stale = !!owner && spent.includes(owner.id);
  return (
        <div className={`pu-virgil${portrait ? "" : " nopic"}`}>
          {portrait && (
            <img className="pu-virgil-pic" src={VIRGIL.portrait} alt="" aria-hidden="true" />
          )}
          <span className="pu-virgil-text">
            <span className="pu-virgil-who">
              {VIRGIL.name.toUpperCase()}
              {status && (
                <span className={`pu-virgil-live${statusOn ? " on" : ""}`}>
                  <i />{status}
                </span>
              )}
              {onToggleTips && (
                <button type="button" className="pu-virgil-mute" onClick={onToggleTips}
                        title={virgil?.tip
                          ? "Quiet him down — the running order stays on screen"
                          : "Let him chime in again"}>
                  {virgil?.tip ? "tips on" : "tips off"}
                </button>
              )}
              {onReplayBrief && (
                <button type="button" className="pu-virgil-mute" onClick={onReplayBrief}
                        title="Have Virgil run through the house rules again">
                  rules
                </button>
              )}
            </span>
            {/* THE READ LEADS, THE RUNNING ORDER FOLLOWS (author, 2026-08-04:
                the agenda line "That's not helpful at all. Better if he
                advises 'Somebody said this. He isn't saying who' — that's the
                real advice to consider").

                THIS REVERSES THE 2026-08-03 ORDER and the reversal is the
                point, so the old reasoning is worth keeping rather than
                overwriting: the agenda led because it is the half nobody else
                supplies and the half that never turns off, and because when
                the two were CONCATENATED the eye skipped the block and the
                actionable half went with it. Both those facts still hold. What
                changed is which half is actionable on the beat it lands.

                The agenda is a RESOURCE READOUT — it pays off only for a
                player already tracking lane budgets, and reads as scheduling
                noise to everyone else. The tip is the READ: it names the shape
                of the weak argument you are looking at, in a cat's voice, at
                the moment you are deciding whether to spend a specialist on
                it. Leading with it is not demoting the agenda — that stays on
                screen for everyone, under the switch's floor, exactly as §3
                requires. It is putting the sentence a player can act on first.

                NOTE FOR §7 ITEM 6 ("Let Virgil be wrong"): the tips are an
                oracle today, always correct about the shape. Promoting the
                oracle to the lead line makes that open item more load-bearing,
                not less. */}
            {/* WHOSE THIS IS, FIRST — and it is on the ALWAYS-ON side of the
                switch, with the agenda, never with the tip. The tip is
                mutable; who goes deepest on a claim is the one fact the floor
                cannot take away, so putting it behind "tips off" would delete
                the input the seat decision runs on (§3). */}
            <span className="pu-virgil-lane" data-lane={stale ? "SPENT" : claim.lane}>
              {laneSentence(claim, { spent, remaining, earlier })}
            </span>
            {virgil?.tip && <span className="pu-virgil-tip">{virgil.tip}</span>}
            {/* THE AGENDA IS CUT (author, 2026-08-05: "there is an extra block
                of text in virgil's section that can be cut… that's just noise
                in an already excessive amount of text to look at").

                It was NEVER SPOKEN — only the tip and the next move are — so it
                was pure page weight in the panel the overload report is about.
                And in the case the author quoted it is a near-verbatim restating
                of the lane line directly above it: "Marisol is spent, anyone
                else gets the shallow version" against "Marisol has already taken
                a deep look, anyone else can only give you a surface view."

                WHAT WENT WITH IT, so it can be recovered deliberately rather
                than rediscovered: the UNSPENT variant (virgil.js:265) carried a
                count the lane line does not — "two more money questions after
                this one" — which is the opportunity cost of spending a
                specialist now versus saving them. If that is missed, the move is
                to fold the count into laneSentence as a clause, not to restore a
                second paragraph. The generator in virgil.js is left intact for
                exactly that. §3's requirement is untouched either way: who goes
                deepest and who is spent is the LANE line's job, and it is still
                on the always-on side of the tips switch. */}
            {/* THE CONTROLS, LAST. Read → running order → what you can do about
                it: the same order he says them in, so the panel and the voice
                cannot disagree about which thought came first. Styled like the
                agenda rather than the tip because it is actionable, not
                flavour. */}
            {reveal >= 2 && virgil?.nextMove && (
              <span className="pu-virgil-next">{virgil.nextMove}</span>
            )}
          </span>
        </div>
  );
}

/**
 * The answer. TWO VOICES: the adviser went and looked, so the finding is
 * theirs; the pitcher then reacts to being checked. Rendering only the reaction
 * under the adviser's name is what made this read as a jumble.
 *
 * THE REACTION NO LONGER PLAYS ITSELF (2026-08-02). The two voices used to run
 * back to back in one chain — "the character speaks and then the pitchbot
 * automatically resumes" (author) — which spent the most interesting moment in
 * the game on nobody's decision. The seat has just produced something, or failed
 * to; the seller is about to explain it away. Which of those you spend the beat
 * on is a real choice, and it was being made for you.
 *
 * So the exchange now stops at `stage: "choice"` and offers both. See
 * AnswerChoice. Neither is compulsory — pressing on without doing either is the
 * same forfeiting choice as not pressing at all `[A§18]`.
 *
 * WHAT EACH GATE HIDES, and why it is not just ceremony:
 *   • `stage === "reporting"` — they are still talking. The verdict and the
 *     panel's colour are both derivable the instant you press, so they would
 *     otherwise interpret an answer before it has been given.
 *   • `!flash.looked` — the tone and the note name the OUTCOME, and the outcome
 *     is meant to be something you went and looked at (VC_GAME.md §2).
 *   • `!flash.heard` — the pitcher's line is the thing HEAR buys. Printing it
 *     while offering to play it makes the button decorative.
 *
 * `children` is the choice row; each surface passes its own handlers because
 * "go and look" means a pane swap on one surface and a camera move on the other.
 */
export function AnswerBody({ flash, children }) {
  if (!flash) return null;
  const held = flash.stage === "reporting";
  const looked = !!flash.looked;
  const tone = held || !looked
    ? ""
    : flash.nothingOnFile ? "nil" : flash.backing === BACKING.VIBES ? "vibes" : "";
  const talking = flash.adviserSays ? (seatMeta(flash.seat)?.name ?? "They") : PITCH_BOT.name;
  return (
    <div className={`pu-answer ${tone}`}>
      {/* SENT IS THE DEAD VERB, and this was the last surface still using it.
          [A§11] cut it for the analysts — they never leave their desks, the
          camera does the moving — and the row above has read ASK A FOLLOW-UP
          ever since. The distinction it leaves is the real one: you ASK a
          neutral colleague and you PRESS the one selling you the deal. */}
      <div className="pu-asked">
        {flash.seat === PITCHER ? "YOU PRESSED" : "YOU ASKED"} — {flash.asked}
      </div>

      {flash.adviserSays && (
        <div className="pu-said">
          <span className="pu-said-who">{seatMeta(flash.seat)?.name}</span>
          <span className="pu-said-line">“{flash.adviserSays}”</span>
        </div>
      )}
      {flash.heard && flash.line && (
        <div className="pu-said barron">
          <span className="pu-said-who">{PITCH_BOT.name}</span>
          <span className="pu-said-line">“{flash.line}”</span>
        </div>
      )}

      {held ? (
        <div className="pu-note waiting">▚ {talking.toUpperCase()} IS STILL TALKING…</div>
      ) : (
        <>
          {looked && <div className="pu-note">{answerNote(flash)}</div>}
          {children}
        </>
      )}
    </div>
  );
}

/**
 * THE TWO WAYS TO SPEND THE BEAT — the decision that used to be made for you.
 *
 * Both stay live after they're taken, and that is deliberate rather than lax:
 * re-reading a receipt is how you check it against what you're then told, and
 * replaying the reaction is how you check the reverse. The ✓ says what you have
 * already done, not what you may no longer do.
 *
 * HEAR IS ABSENT WHEN YOU PRESSED THE PITCHER ITSELF. There is no third party to
 * react to your own question, so its answer plays on the spot and the only thing
 * left to decide is whether to go and read its screen.
 */
export function AnswerChoice({ flash, onLook, onHear }) {
  if (!flash || flash.stage === "reporting") return null;
  const canHear = !!flash.line && !!flash.adviserSays;
  return (
    <div className="pu-choice">
      <button type="button" className={`pu-choice-btn${flash.looked ? " done" : ""}`}
              onClick={onLook}>
        {flash.looked ? "✓ SEEN — LOOK AGAIN" : "▤ SEE WHAT LANDED ▸"}
      </button>
      {/* LET PITCHBOT RESPOND, not HEAR ITS RESPONSE (author, 2026-08-04). It
          is the same construction as the nav's LET PITCHBOT CONTINUE directly
          below it, and the two are the same KIND of move: both hand the floor
          back to the seller. "Hear" described the player's ear; "let" describes
          what is actually being spent, which is the beat. */}
      {canHear && (
        <button type="button" className={`pu-choice-btn hear${flash.heard ? " done" : ""}`}
                onClick={onHear}>
          {flash.heard ? "✓ HEARD — PLAY AGAIN" : "◉ LET PITCHBOT RESPOND ▸"}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* the dock                                                                */
/* ---------------------------------------------------------------------- */

/**
 * Who you can ask, or why you can't ask anyone.
 *
 * GATED ON `live`. When the claim is settled every real control is dead, and a
 * dead row containing one bright unclickable tile inverts the whole
 * affordance — so the row goes away entirely rather than greying out. On mobile
 * it also reclaims ~195px of pinned dock, which is what was shoving the one
 * live control off the bottom of the screen.
 *
 * `compact` — the SAME row, one tile per column instead of five 104px tiles.
 *
 * IT IS A WIDTH ANSWER, NOT A DIFFERENT CONTROL. Five fixed tiles need 544px;
 * a phone gives the dock about 323px, so they wrapped to three rows, the dock
 * grew to 511px of a 751px box, and `.pu-nav` landed at y=810 — under the
 * floor's own `overflow:hidden`, with `.pf-read` squeezed to its 76px minimum.
 * That is the documented failure in VC_GAME.md §6 ("839px of rows in a 700px
 * box... the pitch had no exit") arriving from the one direction the height
 * budget didn't cover, and it is why hiding seats behind a horizontal scroller
 * is the wrong trade: the decision the row exists for is "is this claim worth
 * my one specialist", and you cannot make it against options you can't see.
 *
 * THE SHORT LABELS LIVE HERE, next to the long ones, on purpose. A stylesheet
 * that swapped them with generated content would let someone edit the wording
 * in this file and have the phone silently keep the old words. Same rule as
 * everything else in this module: one place, both surfaces.
 */
export function SeatRow({ run, live, pressed, options, onPress, compact = false }) {
  if (!live) {
    return (
      <div className="pu-spent">
        {pressed ? "◼ YOU'VE HAD YOUR ANSWER ON THIS ONE."
          : "▚ NO QUESTIONS LEFT — THE REST IS ON FAITH."}
      </div>
    );
  }
  return (
    <div className="pu-seatblock">
      {/* THE ROW NEEDS A VERB AND A QUESTION.
          Playtest, 2026-07-28: "i can either press him for a screen or let him
          go on to his next point" — a complete description of the game with the
          desk left out of it, from someone who had the desk on screen. Cause:
          the only things that LOOKED like buttons were LET HIM GO ON and CALL
          IT, so four trading cards read as a cast list. Barron's tile used to
          say PRESS HIM; when he got a lane it became "THE TAPE / shallow look"
          and the last verb in the row went with it.

          THE CARDS THEMSELVES WENT ON 2026-07-28. They were the deeper half of
          that same cause: a card face is a thing you look AT, and four of them
          in a row is a cast list no matter what you print underneath. A
          portrait in a button is a person you can send. The verb header and the
          per-tile sub-labels stay — they were the right fix, they were just
          fixing the symptom. */}
      {/* "ASK A FOLLOW-UP" (author, 2026-07-28), after WHO DO YOU SEND? and
          WHO DO YOU ASK? both missed. It does two jobs where the others did
          half of one:

          1. IT NAMES THE MOVE, so the row finally reads as the alternative to
             LET HIM GO ON — which is the choice the beat is actually about, and
             which players were not seeing (they described the game as "press
             him or let him go on", with the desk left out entirely).
          2. IT ENCODES A RULE THAT WAS ONLY EVER IN THE SOURCE. A press never
             opens a new subject; it interrogates the claim he JUST made from a
             sharper angle. "Follow-up" is that constraint in one word, and
             nothing on screen had ever said it. */}
      <div className="pu-seats-h">
        ASK A FOLLOW-UP
        <em>{run.pressesLeft} question{run.pressesLeft === 1 ? "" : "s"} left</em>
      </div>
      <div className={`pu-seats${compact ? " compact" : ""}`}>
        {options.map((o) => {
          // seatMeta, not DESK — the first option is the PITCHER, which is not
          // staff and has no DESK entry. A bare DESK lookup here threw.
          const meta = seatMeta(o.seat);
          if (!meta) return null;
          const boss = o.seat === PITCHER;
          return (
            <button key={o.seat}
                    className={`pu-seat ${boss ? "boss" : ""} ${o.deep ? "deep" : "shallow"} ${o.enabled ? "" : "off"}`}
                    disabled={!o.enabled}
                    title={boss
                      ? `Press ${meta.name} — costs a question, never a specialist`
                      : o.deep
                        ? `Ask ${meta.name} — this is what they do`
                        : `Ask ${meta.name} anyway — you'll get the surface answer`}
                    onClick={() => onPress(o.seat)}>
              {meta.portrait
                ? <img className="pu-seat-face" src={meta.portrait} alt="" aria-hidden="true" />
                : <span className="pu-seat-face pu-seat-glyph" aria-hidden="true">▣</span>}
              <span className="pu-seat-who">{meta.name}</span>
              <span className="pu-seat-name">{meta.role}</span>
              {/* Every live tile carries a VERB, because every one of them is a
                  legal move. The sub-label prices the move; it never forbids it.

                  TWO VERBS, AND "SEND" WAS NEVER ONE OF THEM. The row said
                  SEND until 2026-07-28, which described something this game
                  does not show: *"the other analysts don't physically leave
                  their desks — that's why 'send' seems weird to me"* (author).
                  Correct, and the adviser prose already agreed with him —
                  Marisol says "Give me a second, I'll pull it", GR80 says "I
                  have read it, one moment". Both are things done AT a desk, and
                  on a press the CAMERA moves, not the character.

                  What survives is the real distinction: you ASK the three
                  colleagues, who are neutral and pull the record on their own
                  machine, and you PRESS Barron, who is selling you the deal.
                  Challenging the seller is a different act from asking a
                  colleague, and the row should never have blurred them. */}
              <span className="pu-seat-sub">
                {o.reason === "spent" ? (compact ? "used" : "already used")
                  : boss
                    // the pitcher owns no lane, so never deep
                    ? (compact ? "free" : "press it · always free")
                    : (o.deep
                        ? (compact ? "▲ GOES DEEP" : "▲ ASK — GOES DEEP")
                        : (compact ? "surface only" : "ask anyway · surface only"))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * THE TRANSCRIPT — what has actually been said, in order.
 *
 * Renders `run.chips`, which the controller has populated since day one and which
 * NEITHER SURFACE HAS EVER SHOWN. `landClaim` pushes { id, fact, spin } as each
 * claim finishes, so the record already exists and this is pure presentation — no
 * controller change, which is what §6 requires.
 *
 * IT IS A RECORD OF SPEECH, NOT OF FINDINGS, and that boundary is a leak rule
 * rather than an editorial preference. `run.outcomes` also holds `receipt`,
 * `backing` and `nothingOnFile`; replaying those here would re-state the verdict
 * for a claim the player may not have LOOKED at yet (the flat surface defers the
 * reveal behind LOOK). Lines were heard out loud, so lines are safe. Verdicts are
 * the answer panel's job, once.
 *
 * `spoken` is optional per-chip supplementary text — the pitcher's reaction and
 * the adviser's report, both already visible when they landed.
 */
export function Transcript({ run, deal, open = true, onToggle = null }) {
  const chips = run?.chips ?? [];
  if (!chips.length) return null;
  return (
    <div className={`pu-script${open ? " open" : ""}`}>
      <div className="pu-script-h">
        ON THE RECORD
        <em>{chips.length} of {deal?.claims?.length ?? chips.length}</em>
        {onToggle && (
          <button type="button" className="pu-script-toggle" onClick={onToggle}
                  title={open ? "Collapse the transcript" : "Show what has been said"}>
            {open ? "hide" : "show"}
          </button>
        )}
      </div>
      {open && (
        <ol className="pu-script-list">
          {chips.map((c, i) => {
            const o = run.outcomes?.[c.id];
            return (
              <li key={c.id} className="pu-script-item">
                <span className="pu-script-n">{i + 1}</span>
                <span className="pu-script-body">
                  <span className="pu-script-spin">“{c.spin}”</span>
                  <span className="pu-script-fact">
                    <span className="pu-tag">FACT</span> {c.fact}
                  </span>
                  {/* Only what was SAID. No receipt, no verdict — see the note
                      above. The beat's stage never reaches here: the chip lands
                      when the CLAIM does, not when the press does, and the
                      transcript is the record of what was said rather than of
                      which half of the exchange you chose to take. */}
                  {o?.adviserSays && (
                    <span className="pu-script-said">
                      <b>{seatMeta(o.seat)?.name}</b> {o.adviserSays}
                    </span>
                  )}
                  {o?.barronSays && (
                    <span className="pu-script-said">
                      <b>{PITCH_BOT.name}</b> {o.barronSays}
                    </span>
                  )}
                  {!o && <span className="pu-script-none">— you let it go on</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * THE CONVICTION GAUGE — the final call, as an instrument rather than a form.
 *
 * WHY IT IS STILL AN <input type="range"> (author, 2026-08-05: "the sliding
 * scale - might be nicer as a dial", then "let's do a restyle on the linear
 * gauge"). A radial dial was the first idea and was talked out of on three
 * counts, recorded here so it doesn't come back by accident:
 *
 *   PRECISION IS THE MECHANIC. The gap between 70% and 85% moves the payout
 *     materially — this is a calibration game, and angular dragging is measurably
 *     coarser than linear at the same pixel budget.
 *   IT SHIPS ON PHONES. A thumb dragging an arc covers the arc. A thumb on a
 *     horizontal track does not cover the track it is travelling.
 *   THE NATIVE CONTROL IS FREE ACCESSIBILITY. Arrow keys, Home/End, focus, and
 *     a screen reader that announces the value — all of it works because this is
 *     a real range input. A custom radial would mean rebuilding every bit of that
 *     as role="slider" with hand-written key handling, and it is normally
 *     rebuilt half way.
 *
 * So the ELEMENT is unchanged and only the SKIN moved: the native track is made
 * transparent and a drawn scale sits behind it, the thumb becomes a needle
 * rather than a dot, and the ends are engraved on the scale instead of floating
 * under it. Every native behaviour is intact; it just stops looking like the one
 * un-styled form control in a room full of instruments.
 *
 * NO PERCENTAGE ON THE FACE, deliberately. The readout beneath already says the
 * conviction in words and the stake in money, and this surface has avoided
 * visible math throughout (see callReadout). A number here would make it a form
 * again — which is the thing being fixed.
 *
 * The centre tick is gold and taller because PASS is a real position, not the
 * absence of one, and the eye needs somewhere to return to.
 */
const GAUGE_TICKS = Array.from({ length: 21 }, (_, i) => i);

export function ConvictionGauge({ value, onChange, min = -100, max = 100, step = 5,
                                  label = "Your conviction" }) {
  return (
    <div className="pu-gauge">
      <div className="pu-gauge-scale" aria-hidden="true">
        {GAUGE_TICKS.map((i) => (
          <i key={i} className={`pu-gauge-tick${i === 10 ? " centre" : i % 5 === 0 ? " major" : ""}`} />
        ))}
        <span className="pu-gauge-rail" />
      </div>
      <input
        className="pu-gauge-input"
        type="range" min={min} max={max} step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="pu-gauge-ends"><span>FUD</span><span>PASS</span><span>FUND</span></div>
    </div>
  );
}

/** Interruptions left. `children` is an extra badge slot — mobile counts the
 *  advisers there too, since it has no agenda rail to show them. */
export function Meter({ run, presses, children }) {
  /* THE PRICE OF THE NEXT QUESTION, next to the count of them.
     A price the player cannot see before spending is not an incentive, it is a
     hidden penalty — and the whole point of pricing the budget (see PRESS_COST
     in pressRun.js) is to make "is this claim worth a question?" a live
     decision. It sits on the meter because the meter is already the thing that
     answers "how many have I got"; the cost of the next one belongs with the
     count of them, not on a fourth element somewhere else.
     Quiet by default and quiet on purpose: this is a number to glance at while
     deciding, not a scoreboard. It should never out-shout the claim. */
  const price = pressPrice(run);
  return (
    <div className="pu-meter" aria-label={`${run.pressesLeft} questions left`}>
      {Array.from({ length: presses }).map((_, i) => (
        <span key={i} className={i < run.pressesLeft ? "on" : ""} />
      ))}
      <em>QUESTIONS LEFT</em>
      {price && (
        <i className="pu-price" title="Every question you spend trims the stake you play for.">
          PLAYING FOR ±{price.now} · A SPECIALIST MAKES IT ±{price.after}
        </i>
      )}
      {children}
    </div>
  );
}

/**
 * On the last claim `advance` and `callIt` are the SAME transition
 * (pressRun.advance: next >= claims.length -> ALLOCATION), so two buttons there
 * would be two labels for one door.
 */
export function Nav({ lastClaim, pressed, onAdvance, onCallIt }) {
  return (
    <div className="pu-nav">
      {lastClaim ? (
        <button className="pu-btn primary" onClick={onCallIt}>THAT'S THE PITCH — CALL IT ▸</button>
      ) : (
        <>
          {/* NEXT POINT, not LET PITCHBOT CONTINUE (author, 2026-08-04: "the
              pitchbot image button and also a button that says 'Let Pitchbot
              Continue'... is this just a redundancy?").

              They are OPPOSITES, which is what made the collision worth fixing
              rather than explaining: the tile 30px above spends a question
              CHALLENGING the bot, and this spends nothing and lets it move on.
              Naming the bot in both made the two reads as one control, and a
              third had just joined them — LET PITCHBOT RESPOND in the answer
              box. Three "PITCHBOT" verbs in one dock.

              So exactly one control keeps the bot as its object (the one that
              hands it the floor: LET PITCHBOT RESPOND), and this one is named
              for what it does to the PITCH instead. It is the decline path —
              what you do when you spend nothing — and "next point" is what
              declining actually gets you. */}
          <button className={`pu-btn${pressed ? " primary" : ""}`} onClick={onAdvance}>NEXT POINT ▸</button>
          <button className="pu-btn amber" onClick={onCallIt}>CALL IT</button>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* styled once — callers position their own containers around these        */
/* ---------------------------------------------------------------------- */

export const PRESS_UI_CSS = `
.pu-dim { color:rgba(234,255,249,0.5); font-weight:normal; }

/* HIS BORDER IS THE MOOD RING. Cool pink while he's comfortable, cooling to
   cyan when you check him and he holds up, heating to amber then red as the
   room turns. Cheapest possible read of "how is this going for him". */
.pu-claim { border-left:2px solid #ff5f9e; padding:10px 14px;
  transition:border-left-color .35s ease; }
.pu-claim[data-mood="backed"]   { border-left-color:#2fd6d6; }
.pu-claim[data-mood="rattled"]  { border-left-color:#ffd23a; }
.pu-claim[data-mood="cornered"] { border-left-color:#ff2d2d; border-left-width:3px; }
/* WRAPS AS A ROW, NEVER MID-TOKEN. Every part of this line is a label, and a
   flex container that lets its items break internally turns them into
   nonsense at a phone's width: "PITCH / BOT", "— its client's / deal", and
   the count reading "1 / / 6". white-space:nowrap on the container reaches
   the anonymous text items too (the bot's name is a bare text node and can't
   be targeted any other way); flex-wrap is what still lets the ROW break, so
   nothing overflows — it just breaks between labels instead of inside one. */
.pu-who { display:flex; align-items:baseline; flex-wrap:wrap; gap:2px 6px;
  white-space:nowrap;
  font:bold 9.5px/1.4 'Courier New',monospace; letter-spacing:0.13em; color:#ff5f9e; }
.pu-mood { font-size:8.5px; letter-spacing:0.16em; padding:1px 5px; }
.pu-mood.backed   { color:#02100e; background:#2fd6d6; }
.pu-mood.rattled  { color:#02100e; background:#ffd23a; }
.pu-mood.cornered { color:#fff; background:#ff2d2d; }
.pu-aside { font-size:12.5px; line-height:1.4; font-style:italic; margin:7px 0 2px;
  padding-left:9px; border-left:2px solid rgba(255,255,255,0.18);
  color:rgba(234,255,249,0.62); }
.pu-count { margin-left:auto; color:rgba(234,255,249,0.45); letter-spacing:0.1em; }
/* WHAT THIS CLAIM IS ABOUT. Sized between the speaker line and the fact — it is
   a label, not a voice, so it must not compete with the sentence underneath it.
   Cyan ties it to the FACT tag it heads rather than to the pink speaker line. */
.pu-subject { margin:8px 0 5px;
  font:bold 9.5px/1.4 'Courier New',monospace; letter-spacing:0.15em;
  color:rgba(47,214,214,0.85); }
/* THE LEAD. Same voice as the spin and deliberately a step quieter than it —
   framing, not argument — so the eye runs lead → fact → spin and the loudest
   line is the one being judged. */
.pu-lead { font-size:12.5px; line-height:1.42; margin:0 0 7px;
  color:rgba(234,255,249,0.72); }
/* THE SPIN NOW FOLLOWS THE FACT, so its top margin closes the gap to the line it
   is built on and its bottom margin opens one before Virgil. */
.pu-spin { font-size:14px; line-height:1.42; margin:9px 0 4px; }

/* THE OPENING. Same block as a claim so the transition into claim 1 is a change
   of CONTENT, not a change of furniture — the border, the name line and the
   quoted voice all stay put and only what he is saying moves on. */
.pu-open-line { font-size:14px; line-height:1.45; margin:9px 0 0;
  color:rgba(234,255,249,0.72); }
/* The line being spoken is the bright one; the ones already said stay readable
   but recede, so the eye lands where the voice is without the block flickering. */
.pu-open-line.now { color:#eafff9; animation:puOpenIn .3s ease both; }
@keyframes puOpenIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
.pu-skip { margin-left:auto; flex:none; cursor:pointer;
  background:none; border:1px solid rgba(234,255,249,0.28); color:rgba(234,255,249,0.6);
  font:bold 8.5px/1 'Courier New',monospace; letter-spacing:0.13em; padding:3px 6px; }
.pu-skip:hover { border-color:rgba(234,255,249,0.55); color:#eafff9; }
@media (prefers-reduced-motion:reduce) { .pu-open-line.now { animation:none; } }
/* THE FACT BELONGS TO THE QUOTE ABOVE IT, and it did not look like it (author,
   2026-08-04: "i see a line by itself... shouldn't this be something Virgil
   advises?"). It should NOT be Virgil's — he is mutable, and invariant 1 plus
   §3 require the deal stay solvable with him muted, so nothing checkable can
   sit behind the tips switch. What was wrong is that it read as a stray UI row:
   the spin is in quotation marks and this was not, so two halves of one
   utterance looked like a sentence and a widget.
   Indented under the quote with a hairline rule, it reads as what it is — the
   part of what the bot just said that you could actually go and check. */
.pu-fact { font-size:11.5px; line-height:1.45; color:rgba(234,255,249,0.85);
  margin-left:10px; padding-left:10px; border-left:1px solid rgba(47,214,214,0.28); }
.pu-tag { font:bold 8.5px/1 'Courier New',monospace; letter-spacing:0.13em;
  background:#2fd6d6; color:#02100e; padding:2px 4px; margin-right:5px; }

/* .pu-lane IS GONE WITH ITS BOX. It was a colour-coded panel with its own
   border, background and inset — a second framed block stacked on the cat's,
   both answering "who should look at this". The sentence lives inside Virgil
   now (.pu-virgil-lane), so it keeps the lane's COLOUR as type and drops the
   panel: one box, three lines, in one voice. */
.pu-virgil-lane { font-size:12.5px; line-height:1.4; color:rgba(234,255,249,0.9); }
.pu-virgil-lane[data-lane="CHAIN"]  { color:#8ff0f0; }
.pu-virgil-lane[data-lane="RECORD"] { color:#ffe487; }
.pu-virgil-lane[data-lane="CHART"]  { color:#ffa8ca; }
.pu-virgil-lane[data-lane="SOCIAL"] { color:#d8f7ec; }
/* the lane's owner is spent — this claim is now nobody's, and it should not
   read like a live instruction */
.pu-virgil-lane[data-lane="SPENT"]  { color:#ffb493; }

/* THE TRANSCRIPT. Deliberately quiet: it is a reference you consult, never
   something competing with the claim on the floor. Scrolls inside itself so it can
   never grow the column it lives in — the flat surface pins three rows around one
   scroller and a second growing child breaks that contract. */
.pu-script { border-top:1px solid rgba(47,214,214,0.18); margin-top:10px;
  padding-top:8px; min-width:0; }
.pu-script-h { display:flex; align-items:center; gap:8px;
  font:bold 9px/1.3 'Courier New',monospace; letter-spacing:0.14em;
  color:rgba(47,214,214,0.8); }
.pu-script-h em { font-style:normal; font-weight:normal; letter-spacing:0.08em;
  color:rgba(234,255,249,0.4); }
.pu-script-toggle { margin-left:auto; background:none; border:none; cursor:pointer;
  font:9px/1 'Courier New',monospace; letter-spacing:0.1em;
  color:rgba(47,214,214,0.7); text-decoration:underline; padding:2px 0; }
.pu-script-list { list-style:none; margin:6px 0 0; padding:0;
  max-height:190px; overflow-y:auto; overscroll-behavior:contain; }
.pu-script-item { display:flex; gap:7px; padding:6px 0;
  border-top:1px dotted rgba(234,255,249,0.1); }
.pu-script-item:first-child { border-top:none; }
.pu-script-n { flex:none; width:14px; text-align:right;
  font:bold 9px/1.5 'Courier New',monospace; color:rgba(255,210,58,0.55); }
.pu-script-body { display:flex; flex-direction:column; gap:3px; min-width:0; }
.pu-script-spin { font-size:11px; line-height:1.4; color:rgba(234,255,249,0.82); }
.pu-script-fact { font-size:10px; line-height:1.4; color:rgba(234,255,249,0.55); }
.pu-script-said { font-size:10px; line-height:1.4; color:rgba(191,238,222,0.72); }
.pu-script-said b { color:#bfeede; font-weight:bold; }
.pu-script-none { font-size:9.5px; font-style:italic;
  color:rgba(234,255,249,0.32); letter-spacing:0.04em; }

/* The pitcher has no portrait yet, so its tile carries a glyph instead of a
   borrowed face. Sized to match .pu-seat-face exactly so the row doesn't jump. */
.pu-seat-glyph { display:flex; align-items:center; justify-content:center;
  font-size:20px; color:rgba(191,222,255,0.75);
  background:rgba(120,200,255,0.07); }

/* VIRGIL. Warmer than the desk chrome — he is a companion, not a terminal. */
.pu-virgil { display:flex; gap:9px; align-items:flex-start; margin-top:9px; padding-top:8px;
  border-top:1px dashed rgba(191,238,222,0.22); }
.pu-virgil-pic { flex:none; width:34px; height:34px; border-radius:50%; object-fit:cover;
  border:1px solid rgba(191,238,222,0.45); background:rgba(2,16,14,0.6); }
/* NO PORTRAIT — the surface is supplying its own face (see VirgilRead's portrait
   prop). Nothing else changes here: the block is still a flex row, the surface's
   element simply takes the picture's slot as a sibling. */
.pu-virgil.nopic { margin-top:0; padding-top:0; border-top:none; }
/* LIVE / ON AIR, for a surface that is running his player. currentColor drives
   the dot so the two can never disagree about the state. */
.pu-virgil-live { display:inline-flex; align-items:center; gap:4px; flex:none;
  font-size:8px; letter-spacing:0.14em; color:rgba(234,255,249,0.4);
  transition:color .3s ease; }
.pu-virgil-live i { width:5px; height:5px; border-radius:50%; background:currentColor; }
.pu-virgil-live.on { color:#ff5f9e; }
.pu-virgil-live.on i { box-shadow:0 0 6px #ff5f9e; }
@media (prefers-reduced-motion:reduce) { .pu-virgil-live { transition:none; } }
.pu-virgil-text { display:flex; flex-direction:column; gap:3px; min-width:0; flex:1; }
.pu-virgil-who { display:flex; align-items:baseline; gap:8px;
  font:bold 10px/1.45 'Courier New',monospace; letter-spacing:0.11em; color:#bfeede; }
.pu-virgil-mute { margin-left:auto; background:none; border:1px solid rgba(191,238,222,0.3);
  color:rgba(191,238,222,0.6); font:inherit; font-size:8.5px; letter-spacing:0.1em;
  padding:1px 6px; cursor:pointer; }
.pu-virgil-mute:hover { color:#bfeede; border-color:rgba(191,238,222,0.6); }
/* THE TIP LEADS AND CARRIES THE WEIGHT — see the render site for why the two
   swapped on 2026-08-04. It keeps the italic, because it is still a cat's
   remark rather than a readout, but it is now the bright one.
   THE AGENDA NEVER TURNS OFF. It is still the only information on the floor
   nobody else supplies and still what makes holding a specialist a decision
   rather than a guess — it is the SECOND line now, not a demoted one, and the
   two must never be concatenated (that is what trained the eye to skip both). */
/* The controls he just named. Gold, because that is this UI's colour for the
   move that is yours to make (.pu-seats-h, the gate's cue). */
.pu-virgil-next { font-size:11.5px; line-height:1.4; color:#ffd23a; }
.pu-virgil-tip { font-size:12.5px; line-height:1.4; color:#d8f7ec;
  font-weight:bold; font-style:italic; }
.pu-virgil-agenda { font-size:11.5px; line-height:1.4; color:rgba(191,238,222,0.72); }

.pu-answer { padding:10px 12px; background:rgba(4,20,15,0.97); border:1.5px solid #ffd23a; }
.pu-answer.vibes { border-color:#7a8b86; }
.pu-answer.nil { border-color:#ff9b6f; }
.pu-asked { font:bold 8.5px/1.4 'Courier New',monospace; letter-spacing:0.11em;
  color:rgba(234,255,249,0.5); margin-bottom:7px; }
.pu-said { margin-bottom:7px; }
.pu-said-who { display:block; font:bold 9px/1.4 'Courier New',monospace;
  letter-spacing:0.12em; color:#2fd6d6; }
.pu-said.barron .pu-said-who { color:#ff5f9e; }
.pu-said-line { display:block; font-size:12.5px; line-height:1.45; font-style:italic; margin-top:2px; }
.pu-note { font:bold 9.5px/1.45 'Courier New',monospace; letter-spacing:0.09em; color:#ffd23a; }
.pu-answer.vibes .pu-note { color:#bfeede; }
.pu-answer.nil .pu-note { color:#ff9b6f; }
.pu-note.waiting { color:rgba(234,255,249,0.35); font-weight:normal; }

/* THE CHOICE. Two buttons, equal weight — neither is the default and the layout
   must not imply one. Stacked rather than side by side: on the flat surface's
   column they would be ~120px each and wrap anyway, and a pair of full-width
   rows reads as two options where a half-width pair reads as confirm/cancel. */
.pu-choice { display:flex; flex-direction:column; gap:6px; margin-top:9px; }
.pu-choice-btn { display:block; width:100%; cursor:pointer; text-align:left;
  padding:9px 10px; background:rgba(47,214,214,0.10);
  border:1px solid rgba(47,214,214,0.55); color:#2fd6d6;
  font:bold 10px/1.2 'Courier New',monospace; letter-spacing:0.11em; }
.pu-choice-btn:hover { background:rgba(47,214,214,0.18); }
/* THE SELLER'S HALF IS PINK, the evidence half cyan — the same two colours the
   claim border and the seat row already use for "the one selling" and "the ones
   who went and looked". The choice is legible before the words are read. */
.pu-choice-btn.hear { background:rgba(255,95,158,0.10);
  border-color:rgba(255,95,158,0.55); color:#ff5f9e; }
.pu-choice-btn.hear:hover { background:rgba(255,95,158,0.18); }

/* THE GATE — the one control the beat is waiting on, and the only animating
   thing on screen while it is up. See the note at OpeningBody: a busy 3D room
   was swallowing a 10px translucent bar, so this is louder on purpose and its
   cue names it as a MOVE rather than as an option. */
.pu-gate { gap:5px; margin-top:12px; }
.pu-gate-cue { font:bold 9px/1.3 'Courier New',monospace; letter-spacing:0.18em;
  color:#ffd23a; }
.pu-choice-btn.gate { padding:12px; font-size:11.5px;
  background:rgba(255,95,158,0.20); border-color:#ff5f9e; color:#ffd9e8;
  animation:pu-gate-pulse 1.9s ease-in-out infinite; }
.pu-choice-btn.gate:hover { background:rgba(255,95,158,0.32); animation:none;
  box-shadow:0 0 16px 2px rgba(255,95,158,0.38); }
@keyframes pu-gate-pulse {
  0%, 100% { box-shadow:0 0 0 0 rgba(255,95,158,0.00); }
  50%      { box-shadow:0 0 15px 2px rgba(255,95,158,0.34); }
}
/* Still obviously the live control without moving — a held glow, not a pulse. */
@media (prefers-reduced-motion:reduce) {
  .pu-choice-btn.gate { animation:none; box-shadow:0 0 12px rgba(255,95,158,0.30); }
}
/* TAKEN, NOT SPENT. Still live — re-reading the receipt against what you were
   then told, and replaying the reaction against the receipt, are both real
   moves. Dimmed only so the untaken one is the one that catches the eye. */
.pu-choice-btn.done { opacity:0.55; font-weight:normal; }

/* THE SEAT ROW IS THE PRIMARY CONTROL and must out-shout the nav beneath it.
   It did not, and the game read as "press him or move on". */
.pu-seatblock { display:flex; flex-direction:column; gap:6px; }
.pu-seats-h { display:flex; align-items:baseline; gap:8px;
  font:bold 10.5px/1.3 'Courier New',monospace; letter-spacing:0.14em; color:#ffd23a; }
.pu-seats-h em { font-style:normal; font-weight:normal; font-size:9.5px;
  letter-spacing:0.08em; color:rgba(234,255,249,0.55); margin-left:auto; }
.pu-seats { display:flex; gap:6px; justify-content:flex-end; }
.pu-seat { background:rgba(2,16,14,0.9); border:1px solid rgba(47,214,214,0.35); color:#eafff9;
  cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:3px;
  padding:8px 9px 7px; font:inherit; width:104px;
  transition:transform .12s ease, border-color .12s ease; }
/* THE PORTRAIT, not a card face (see the note on the row above). Square and
   small: this is a button with a person on it, and the moment it gets big
   enough to study it goes back to being a thing you look at instead of press.
   Never a pointer target itself, so the click always belongs to the button. */
.pu-seat-face { display:block; width:56px; height:56px; object-fit:cover;
  border-radius:50%; border:1px solid rgba(47,214,214,0.4); pointer-events:none;
  background:#020f0d; transition:border-color .12s ease; }
.pu-seat.boss .pu-seat-face { border-color:rgba(255,45,111,0.55); }
.pu-seat.deep:not(.off):not(:disabled) .pu-seat-face { border-color:#ffd23a; }
.pu-seat-who { font:bold 9px/1.2 'Courier New',monospace; letter-spacing:0.06em;
  color:rgba(234,255,249,0.9); text-align:center; }
.pu-seat:hover:not(:disabled):not(.fixture) { transform:translateY(-3px); border-color:#2fd6d6; }
.pu-seat.boss { border-color:rgba(255,45,111,0.6); background:rgba(60,6,28,0.55); }
.pu-seat.boss:hover:not(:disabled) { border-color:#ff2d6f; }
.pu-seat.fixture { cursor:default; border-style:dashed; border-color:rgba(191,238,222,0.4);
  background:rgba(2,16,14,0.6); }
.pu-seat.fixture .pu-seat-who { color:#bfeede; }
.pu-seat.fixture .pu-seat-sub { color:rgba(191,238,222,0.7); }
.pu-seat.off, .pu-seat:disabled { cursor:default; opacity:0.55; filter:grayscale(0.85);
  border-color:rgba(234,255,249,0.14); background:rgba(2,16,14,0.55); }
/* The specialist for this claim, lit. Everyone else is still live and still
   clickable — dimmer, not disabled, because sending the wrong expert is a legal
   and sometimes correct move. */
.pu-seat.deep:not(.off):not(:disabled) { border-color:#ffd23a;
  box-shadow:0 0 0 1px rgba(255,210,58,0.35), 0 0 18px rgba(255,210,58,0.22); }
.pu-seat.deep .pu-seat-sub { color:#ffd23a; font-weight:bold; }
.pu-seat.shallow:not(.off):not(:disabled) { opacity:0.9; }
.pu-seat.shallow .pu-seat-sub { color:rgba(234,255,249,0.62); }
.pu-seat.deep:not(.off):not(:disabled) { transform:translateY(-3px); }
.pu-seat.deep:not(.off):not(:disabled):hover { transform:translateY(-6px); }
/* THE NAME LEADS, THE ROLE FOLLOWS. The lane band names a PERSON — "Detective
   Marisol goes deepest on it" — so a tile that shows only a role and a face
   makes the player do a lookup the UI should have done. Card faces carried the
   name for free; portraits don't, and dropping it was the near-miss in this
   swap. */
.pu-seat-name { font:9px/1.25 'Courier New',monospace; letter-spacing:0.11em;
  color:rgba(234,255,249,0.6); }
.pu-seat.boss .pu-seat-who { color:#ff5f9e; }
.pu-seat-sub { font-size:9.5px; color:rgba(234,255,249,0.62); }
.pu-seat.off .pu-seat-sub, .pu-seat:disabled .pu-seat-sub { color:rgba(255,155,111,0.9); }

/* THE COMPACT ROW — one column per option, whatever the count. grid-auto-flow
   with auto-columns rather than repeat(5,...) because the number of seats is
   the controller's business: seatOptions returns PITCHER + SPENDABLE_SEATS,
   and a hard 5 here would be a rule in a presentation the day a seat is added.
   Everything below is a metric, not a behaviour — the states, the lit
   specialist and the lift all come from the rules above unchanged. */
.pu-seats.compact { display:grid; grid-auto-flow:column;
  grid-auto-columns:minmax(0,1fr); gap:4px; }
.pu-seats.compact .pu-seat { width:auto; min-width:0; padding:6px 2px 5px; gap:2px; }
.pu-seats.compact .pu-seat-face { width:34px; height:34px; }
/* Two lines reserved for the name at this size too — "Detective Marisol" wraps
   and nobody else does, and a grid row is only as tall as its tallest tile, so
   without the reservation every other tile's role and verb sit a line high. */
.pu-seats.compact .pu-seat-who { font-size:8px; line-height:1.15; letter-spacing:0.02em;
  min-height:2.3em; display:flex; align-items:center; }
.pu-seats.compact .pu-seat-name { font-size:7px; letter-spacing:0.05em; text-align:center; }
.pu-seats.compact .pu-seat-sub { font-size:8px; line-height:1.25; text-align:center; }

.pu-spent { font:bold 9.5px/1.5 'Courier New',monospace; letter-spacing:0.1em;
  color:rgba(191,238,222,0.7); padding:12px 4px; text-align:center;
  border:1px dashed rgba(191,238,222,0.28); }

/* THE CONVICTION GAUGE. The native input is kept and made invisible; everything
   you see is drawn behind it. Nothing here may set pointer-events:none on the
   input — it IS the control. */
.pu-gauge { position:relative; width:100%; max-width:460px; margin:0 auto; }
.pu-gauge-scale {
  position:relative; height:22px; display:flex; align-items:flex-end;
  justify-content:space-between; padding:0 1px;
}
.pu-gauge-tick { width:1px; height:6px; background:rgba(47,214,214,.3); }
.pu-gauge-tick.major { height:12px; background:rgba(47,214,214,.6); }
/* PASS is a position, not the absence of one — the eye needs a home to return
   to, so dead centre is the only gold mark on the face. */
.pu-gauge-tick.centre { width:2px; height:17px; background:rgba(255,210,58,.85); }
.pu-gauge-rail {
  position:absolute; left:0; right:0; bottom:0; height:2px; border-radius:1px;
  background:linear-gradient(90deg,
    rgba(255,45,111,.85) 0%, rgba(255,45,111,.25) 34%,
    rgba(255,210,58,.5) 50%,
    rgba(77,255,170,.25) 66%, rgba(77,255,170,.85) 100%);
}
/* The input sits ON the scale and owns the hit area. -20px pulls its track over
   the rail the scale just drew, so the needle rides the calibrated face. */
.pu-gauge-input {
  position:relative; display:block; width:100%; height:34px; margin:-20px 0 0;
  background:none; -webkit-appearance:none; appearance:none; cursor:pointer;
}
.pu-gauge-input::-webkit-slider-runnable-track { height:34px; background:none; border:none; }
.pu-gauge-input::-moz-range-track { height:34px; background:none; border:none; }
/* THE NEEDLE — a machined bar, not a dot. Two shadows: a tight white core so it
   reads as lit metal, and a wide pink bloom so it is findable against the room
   on the desktop surface, where this floats over live 3D. */
.pu-gauge-input::-webkit-slider-thumb {
  -webkit-appearance:none; appearance:none;
  width:3px; height:28px; border-radius:1px; border:none; background:#fff;
  box-shadow:0 0 6px rgba(255,255,255,.95), 0 0 18px rgba(255,45,111,.55);
  margin-top:3px;
}
.pu-gauge-input::-moz-range-thumb {
  width:3px; height:28px; border-radius:1px; border:none; background:#fff;
  box-shadow:0 0 6px rgba(255,255,255,.95), 0 0 18px rgba(255,45,111,.55);
}
/* Keyboard focus must be visible — this control is reachable by arrow keys and
   that is half the reason it stayed a native input. */
.pu-gauge-input:focus { outline:none; }
.pu-gauge-input:focus-visible::-webkit-slider-thumb {
  box-shadow:0 0 0 2px rgba(47,214,214,.9), 0 0 14px rgba(47,214,214,.7);
}
.pu-gauge-input:focus-visible::-moz-range-thumb {
  box-shadow:0 0 0 2px rgba(47,214,214,.9), 0 0 14px rgba(47,214,214,.7);
}
/* ENGRAVED ON THE FACE, not floating under it — the ends are part of the
   instrument, so they take the scale's own colour and letterspacing. */
.pu-gauge-ends {
  display:flex; justify-content:space-between; margin-top:-2px;
  font:bold 9px/1 'Courier New',monospace; letter-spacing:.18em;
  color:rgba(200,229,223,.5);
}
.pu-gauge-ends span:nth-child(2) { color:rgba(255,210,58,.7); }

.pu-meter { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
/* The price of the next question — deliberately the quietest thing in the row.
   It is a number to glance at while deciding, not a scoreboard; if it ever
   competes with the claim for attention it has failed. */
.pu-meter .pu-price {
  font-style:normal; font:9px/1 'Courier New',monospace; letter-spacing:.08em;
  color:rgba(234,255,249,0.42); white-space:nowrap; margin-left:2px;
}
.pu-meter > span { width:10px; height:10px; border-radius:50%; border:1.5px solid rgba(255,45,111,0.6); }
.pu-meter > span.on { background:#ff2d6f; box-shadow:0 0 8px rgba(255,45,111,0.8); }
.pu-meter em { font-style:normal; font:bold 9.5px/1 'Courier New',monospace;
  letter-spacing:0.11em; color:rgba(234,255,249,0.5); margin-left:5px; }

.pu-nav { display:flex; gap:8px; }
.pu-nav > * { flex:1; }
/* The nav is the DECLINE path: what you do when you spend nothing. It used to
   be the only button-shaped thing on screen, which is why the desk went unread. */
.pu-btn { background:none; border:1px solid rgba(47,214,214,0.3); color:rgba(47,214,214,0.8);
  font:inherit; font-size:11px; letter-spacing:0.09em; padding:9px 14px; cursor:pointer;
  text-align:center; }
.pu-btn.amber { border-color:rgba(255,210,58,0.55); color:#ffd23a; }
.pu-btn.primary { border-color:#2fd6d6; background:rgba(47,214,214,0.14); color:#eafff9; font-weight:bold; }
.pu-btn:hover { background:rgba(47,214,214,0.12); }
`;
