"use client";
import React from "react";
import { BACKING, PITCHER, SEATS } from "@/game/terminal-traders/press/questions";
import { DESK, PITCH_BOT, laneOwner, laneSentence, seatMeta } from "@/game/terminal-traders/press/desk";
import { VIRGIL } from "@/game/terminal-traders/press/virgil";

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
 *     control greyed out and the one deliberately-unclickable tile (Eugene)
 *     became the brightest thing on screen
 *   • `canPress` defined on one surface and referenced on both
 *
 * Four bugs, one cause. What moved here is exactly what drifted: the gate, the
 * claim body, the answer body, the seat row, the meter and the nav.
 *
 * WHAT DELIBERATELY DID NOT MOVE. The two surfaces are not the same layout and
 * should not pretend to be — desktop is an absolutely-positioned reading column
 * over a live 3D room; mobile is one scroll region above a pinned dock, and it
 * has a deferred-reveal beat (`flash.revealed` + LOOK) that desktop has no need
 * for. Each surface keeps its own containers and positioning CSS and composes
 * these pieces inside. If you add a prop here that only one caller ever passes,
 * check first whether it belongs in that caller's container instead.
 *
 * Class names are `pu-*` and shared; PRESS_UI_CSS styles them once.
 */

/** The one definition of "is an interruption legal right now". */
export function canPress(run, claim) {
  return run.pressesLeft > 0 && !!claim && !run.outcomes[claim.id];
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
 * whose specialism it is, and Eugene's free read. `count` is optional ("3 / 6")
 * — mobile shows it because there's no progress rail there.
 */
export function ClaimBody({ claim, virgil = null, onToggleTips = null, spent = [], count = null,
                           pressure = null, aside = "" }) {
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

      <div className="pu-spin">“{claim.spin}”</div>
      <div className="pu-fact"><span className="pu-tag">FACT</span> {claim.fact}</div>

      {/* WHOSE SPECIALISM THIS IS. Not a permission any more — anyone can be
          sent at anything — so this names who goes DEEP and lets you price the
          shallow alternative. A sentence, not a label, because "RECORD
          QUESTION" parsed as either a noun or a verb. It reads the run, so once
          the specialist is spent it says the claim is capped, not closed. */}
      <div className="pu-lane" data-lane={stale ? "SPENT" : claim.lane}>
        {laneSentence(claim, { spent })}
      </div>

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
          brighter, and it is the half that never turns off. */}
      {(virgil?.agenda || virgil?.tip) && (
        <div className="pu-virgil">
          <img className="pu-virgil-pic" src={VIRGIL.portrait} alt="" aria-hidden="true" />
          <span className="pu-virgil-text">
            <span className="pu-virgil-who">
              {VIRGIL.name.toUpperCase()}
              {onToggleTips && (
                <button type="button" className="pu-virgil-mute" onClick={onToggleTips}
                        title={virgil.tip ? "Stop the tips — keep the running order" : "Turn the tips back on"}>
                  {virgil.tip ? "tips on" : "tips off"}
                </button>
              )}
            </span>
            {virgil.agenda && <span className="pu-virgil-agenda">{virgil.agenda}</span>}
            {virgil.tip && <span className="pu-virgil-tip">{virgil.tip}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The answer. TWO VOICES: the adviser went and looked, so the finding is
 * theirs; Barron then reacts to being checked. Rendering only the reaction
 * under the adviser's name is what made this read as a jumble.
 *
 * `flash.revealed === false` means he is still mid-sentence — the verdict and
 * the panel's colour are both derivable right now, so they're withheld until he
 * stops. Undefined means revealed (desktop doesn't defer).
 *
 * `children`, when present, replaces the verdict line — mobile puts its LOOK
 * button in that slot, which is where the verdict itself will land.
 */
export function AnswerBody({ flash, children }) {
  if (!flash) return null;
  const held = flash.revealed === false;
  const tone = held ? "" : flash.nothingOnFile ? "nil" : flash.backing === BACKING.VIBES ? "vibes" : "";
  return (
    <div className={`pu-answer ${tone}`}>
      <div className="pu-asked">YOU SENT — {flash.asked}</div>

      {flash.adviserSays && (
        <div className="pu-said">
          <span className="pu-said-who">{seatMeta(flash.seat)?.name}</span>
          <span className="pu-said-line">“{flash.adviserSays}”</span>
        </div>
      )}
      {flash.line && (
        <div className="pu-said barron">
          <span className="pu-said-who">{PITCH_BOT.name}</span>
          <span className="pu-said-line">“{flash.line}”</span>
        </div>
      )}

      {held ? (
        <div className="pu-note waiting">▚ IT'S STILL TALKING…</div>
      ) : children ? children : (
        <div className="pu-note">{answerNote(flash)}</div>
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
 */
export function SeatRow({ run, live, pressed, options, onPress }) {
  if (!live) {
    return (
      <div className="pu-spent">
        {pressed ? "◼ YOU'VE HAD YOUR ANSWER ON THIS ONE."
          : "▚ NO INTERRUPTIONS LEFT — THE REST IS ON FAITH."}
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
        <em>{run.pressesLeft} interruption{run.pressesLeft === 1 ? "" : "s"} left</em>
      </div>
      <div className="pu-seats">
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
                      ? `Press ${meta.name} — costs an interruption, never a specialist`
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
                {o.reason === "spent" ? "already used"
                  : boss
                    ? "press it · always free"      // the pitcher owns no lane, so never deep
                    : (o.deep ? "▲ ASK — GOES DEEP" : "ask anyway · surface only")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Interruptions left. `children` is an extra badge slot — mobile counts the
 *  advisers there too, since it has no agenda rail to show them. */
export function Meter({ run, presses, children }) {
  return (
    <div className="pu-meter" aria-label={`${run.pressesLeft} interruptions left`}>
      {Array.from({ length: presses }).map((_, i) => (
        <span key={i} className={i < run.pressesLeft ? "on" : ""} />
      ))}
      <em>INTERRUPTIONS LEFT</em>
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
          <button className={`pu-btn${pressed ? " primary" : ""}`} onClick={onAdvance}>LET HIM GO ON ▸</button>
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
.pu-who { display:flex; align-items:baseline; gap:6px;
  font:bold 9.5px/1.4 'Courier New',monospace; letter-spacing:0.13em; color:#ff5f9e; }
.pu-mood { font-size:8.5px; letter-spacing:0.16em; padding:1px 5px; }
.pu-mood.backed   { color:#02100e; background:#2fd6d6; }
.pu-mood.rattled  { color:#02100e; background:#ffd23a; }
.pu-mood.cornered { color:#fff; background:#ff2d2d; }
.pu-aside { font-size:12.5px; line-height:1.4; font-style:italic; margin:7px 0 2px;
  padding-left:9px; border-left:2px solid rgba(255,255,255,0.18);
  color:rgba(234,255,249,0.62); }
.pu-count { margin-left:auto; color:rgba(234,255,249,0.45); letter-spacing:0.1em; }
.pu-spin { font-size:14px; line-height:1.42; margin:6px 0 8px; }
.pu-fact { font-size:11.5px; line-height:1.4; color:rgba(234,255,249,0.85); }
.pu-tag { font:bold 8.5px/1 'Courier New',monospace; letter-spacing:0.13em;
  background:#2fd6d6; color:#02100e; padding:2px 4px; margin-right:5px; }

.pu-lane { margin-top:9px; padding:7px 9px; font:bold 10px/1.4 'Courier New',monospace;
  letter-spacing:0.06em; border-left:3px solid rgba(234,255,249,0.3);
  background:rgba(234,255,249,0.04); color:rgba(234,255,249,0.75); }
.pu-lane[data-lane="CHAIN"]  { border-left-color:#2fd6d6; color:#8ff0f0; background:rgba(47,214,214,0.08); }
.pu-lane[data-lane="RECORD"] { border-left-color:#ffd23a; color:#ffe487; background:rgba(255,210,58,0.08); }
.pu-lane[data-lane="CHART"]  { border-left-color:#ff5f9e; color:#ffa8ca; background:rgba(255,95,158,0.08); }
.pu-lane[data-lane="SOCIAL"] { border-left-color:#bfeede; color:#d8f7ec; background:rgba(191,238,222,0.08); }
/* the lane's owner is spent — this claim is now nobody's, and it should not
   look like a live instruction */
.pu-lane[data-lane="SPENT"]  { border-left-color:#ff9b6f; color:#ffb493; background:rgba(255,155,111,0.07); }

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
.pu-virgil-text { display:flex; flex-direction:column; gap:3px; min-width:0; flex:1; }
.pu-virgil-who { display:flex; align-items:baseline; gap:8px;
  font:bold 10px/1.45 'Courier New',monospace; letter-spacing:0.11em; color:#bfeede; }
.pu-virgil-mute { margin-left:auto; background:none; border:1px solid rgba(191,238,222,0.3);
  color:rgba(191,238,222,0.6); font:inherit; font-size:8.5px; letter-spacing:0.1em;
  padding:1px 6px; cursor:pointer; }
.pu-virgil-mute:hover { color:#bfeede; border-color:rgba(191,238,222,0.6); }
/* THE AGENDA NEVER TURNS OFF and leads the block — it is the only information
   on the floor nobody else supplies, and it is what makes holding a specialist
   a decision rather than a guess. */
.pu-virgil-agenda { font-size:12.5px; line-height:1.4; color:#d8f7ec; font-weight:bold; }
.pu-virgil-tip { font-size:12px; line-height:1.4; color:rgba(191,238,222,0.7); font-style:italic; }

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

.pu-spent { font:bold 9.5px/1.5 'Courier New',monospace; letter-spacing:0.1em;
  color:rgba(191,238,222,0.7); padding:12px 4px; text-align:center;
  border:1px dashed rgba(191,238,222,0.28); }

.pu-meter { display:flex; align-items:center; gap:5px; }
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
