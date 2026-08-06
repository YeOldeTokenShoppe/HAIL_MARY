"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, rollSeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, PITCHER, SEATS, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, DESK_ORDER, PITCH_BOT, laneOwner, laneSentence, pitchOpening, pitcherAside, seatMeta } from "@/game/terminal-traders/press/desk";
import { VIRGIL, virgilRead, briefing,
         afterAnswer as virgilAfterAnswer } from "@/game/terminal-traders/press/virgil";
import { briefingMode, markBriefingSeen } from "@/lib/trade/briefingSeen";
import {
  PHASE, PRESSES, STAKE,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, stakeFor, stakeNote, callVerdict, betRestated, coverageScore, seatOptions, laneOutlook, pressure,
  settlementNote,
} from "@/game/terminal-traders/press/pressRun";
import { preloadSfx } from "@/lib/uiSfx";
import { speakAdviserLine, stopAdviserAudio, unlockAdviserAudio } from "@/lib/counselSpeech";
import { speakVirgilLine, stopVirgilLine, faceVirgilFront, virgilWatchPitcher, lineSeconds, VIRGIL_PORTAL_ID } from "@/lib/trade/virgilVoice";
import { seatHasHostFace, speakSeatOnTempleHost, warmSeatHostFace } from "@/lib/trade/seatVoice";
import SitePalPortalTile from "./SitePalPortalTile";
import { playUnicornBeat, stopUnicornBeat } from "@/lib/trade/playUnicornBeat";
import { setPitchBotPressure, getPitchBotVoice } from "@/lib/trade/pitchBotScene";
import { setUnicornGlow } from "@/lib/trade/unicornGlow";
import {
  EngagementRecord, runArrival, endArrival, skipArrival, prefersReducedMotion, SFX,
  ENGAGEMENT_CSS, peekFileNo, commitFileNo,
} from "./engagement";
import { createEvidenceScreen, SCREEN_AGENTS } from "./evidenceScreen";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, AnswerChoice, OpeningBody, SeatRow,
  ConvictionGauge,
  Meter, Nav, Transcript, VirgilRead, readDwellMs, VIRGIL_BEAT_MS, PRESS_UI_CSS,
} from "./pressUi";

// THE PRESS — slice 1. Barron, six claims, three presses, over the LIVE room.
//
// This component is PRESENTATION ONLY. Every rule lives in pressRun.js, which
// is pure and pinned by scripts/verify-press-run.mjs. If you find yourself
// adding a rule here, it belongs in the controller.
//
// It renders no 3D and owns no texture. The receipt is painted straight into
// the seat's existing shared canvas (window.__screen2Canvas, created by
// VideoScreens) through the EvidenceScreens `evidenceActive` handshake, so the
// scene component needs no changes at all. Everything else is DOM over canvas.
//
// Host contract (all optional so this can be smoke-tested standalone):
//   onFocusAgent(agentId|null)  — fly the camera to a seat
//   onSpeechActive(bool)        — character cross-fades idle(speaking)/typing
//   onRevealChange(outcome|null)— stage the curtain call on the real scene
//   onExit()                    — leave the mode

// THE PITCHER HAS NO BODY IN THE SCENE YET.
//
// This was "Demon" — Connor's agentId — for as long as he was the one
// pitching. Since 2026-07-29 he is a plain CHART specialist you can spend, so
// flying the camera to him when the pitch starts tells the player the wrong
// thing about the cast: it frames a seat as the adversary.
//
// It is 'PitchBot' now — registered in CyborgTempleScene as its own loaded glb
// with an AGENT_CAMERA_SETTINGS pose, an animState entry and userData.agentId on
// every mesh. If the model ever fails to load the scene logs and carries on, and
// resolveAgentSettings still returns the authored pose, so the camera flies to
// where the bot should be rather than throwing.
const PITCHER_AGENT = "PitchBot";

// VIRGIL'S BODY IN THE ROOM is 'Virgil' in CyborgTempleScene (renamed from
// 'Fluffy' on 2026-08-03, since the slot keys clips, focus and the curtain call
// and a surface passing the character's real name silently got no camera move).
//
// NOTHING HERE FOCUSES IT, and that is the finding rather than an omission. The
// press floor cut the camera to him for his line for exactly one afternoon; the
// glb has no face mesh, so the shot was a close-up of a cat not moving its mouth
// while his voice played. His lip-sync is a 2D SitePal player now (.ps-virgil
// below) and the camera stays where the claim is. The 3D cat keeps his idle,
// his blink and his habit of relocating between rounds — he is set dressing that
// happens to be the same character, which is fine, and he is never the shot.

// THE PITCHER'S VOICE — same ElevenLabs voice the flat surface uses (VOICES.PB in
// api/counsel-voice, override with ELEVENLABS_VOICE_PITCHBOT).
//
// DESKTOP WAS MUTE UNTIL 2026-07-29, and mute in a specific, misleading way: this
// surface flipped onSpeechActive(true) for the whole floor and then said nothing,
// so the room held a speaking idle over silence. The reason it was worth fixing
// here rather than routing through SitePal: the pitcher is a glTF bot with a
// screen for a face, not a SitePal mesh, so it takes exactly the audio path the
// flat surface already proved.
/* WHICH VOICE depends on WHICH RIG is in the beam — v1 speaks PB, v2 speaks PB2
 * (eNTStk21PJptqo0CKZTG). Read from the variant config rather than pinned here,
 * so `?pitchbot=v2` swaps the body and the throat together; a hard-coded code
 * would have put the second bot's face on the first bot's voice.
 *
 * MODULE SCOPE IS DELIBERATE AND SAFE. The variant is resolved from the query
 * string once per page load, and swapping rigs already requires a reload, so
 * this has exactly the lifetime the thing it describes does. Under SSR there is
 * no `window`, resolvePitchBotVariant returns the default, and the browser copy
 * of the module — the only one that ever plays audio — resolves it properly.
 *
 * PressFlat stays on "PB" and does NOT import this: that surface has no 3D and
 * no rig, so pulling lib/trade/pitchBotScene in would drag three.js onto the
 * mobile path to answer a question it never asks. */
const VOICE = getPitchBotVoice();

// Minimum time any one utterance holds the camera. Only bites when audio is
// unavailable — see the note in sayTurn.
const MIN_DWELL_MS = 900;
const SPEAKER_STATION = "demon";  // -> __screen2Canvas (SCREEN_TARGETS in evidenceScreen.js)
const READ_MS = 4200;             // how long a claim holds the floor before it can land

// THE ARRIVAL — choreography lives in ./arrival, shared with PressFlat so both
// presentations open the same way. Cards were cut from this game on 2026-07-28
// and reserved for a 2D TCG; the deal is a seeded roll and now looks like one.

export default function PressSession({
  // Pass a deal to pin one (tests/sims). Otherwise the DAILY deal is used —
  // one seeded instance per UTC day, identical for every player, memorisable
  // by nobody. `?dealseed=N` forces a specific one, which is the only way to
  // replay a known rug or a known legit while tuning.
  deal: dealOverride = null,
  onFocusAgent,
  onSpeechActive,
  onRevealChange,
  // TRUE ONLY WHILE THE PITCH IS BEING HEARD — i.e. from HEAR THE PITCH ▸ to the
  // call, not from the moment the game is selected. `pressMode` in /trade goes
  // true at the BRIEFING, which is too early for anything that should appear
  // with the pitcher.
  onFloorChange,
  onExit,
}) {
  // A FRESH DEAL EVERY TIME YOU SIT DOWN. Picked once per mount, so the beat
  // are telling the truth: nobody decided this before you got here.
  //
  // The seed is state rather than a memo dependency because it must be STABLE
  // for the session — deriving it inside the memo would reroll the deal on
  // every render. Reading the override here (not at module scope) keeps this
  // SSR-safe and lets a refresh pick up a new ?dealseed.
  const [seed] = useState(() => {
    const forced = typeof window !== "undefined"
      ? Number(new URLSearchParams(window.location.search).get("dealseed"))
      : NaN;
    return Number.isFinite(forced) && forced > 0 ? forced : rollSeed();
  });
  const deal = useMemo(
    () => dealOverride || instanceDeal(seed), [dealOverride, seed]);

  const [run, setRun] = useState(() => createRun(deal));
  const [slider, setSlider] = useState(0);
  const [flash, setFlash] = useState(null); // the spoken answer to a press
  /* THE OVERLAY STANDS DOWN WHILE YOU ARE LOOKING AT A SCREEN (author,
     2026-08-05: "there is a lot of html overlay that gets in the way - the
     overlay should be turned off when a screen is in focus").
     SEE WHAT LANDED flies the camera to an analyst's monitor, and the reading
     column then sat on top of the left third of the receipt it had just sent the
     player to read — "AGAINST FLOAT" rendering as "INST FLOAT". Set when the
     look happens, cleared by anything that ends the look. */
  const [screenLook, setScreenLook] = useState(false);
  const [claimVisible, setClaimVisible] = useState(false);
  // The opening beat. You land on the wide desk shot and start when you're
  // ready. This is also load-bearing technically: the scene resets the camera
  // to sceneDefaultPose when the model finishes loading, so any focus set
  // before that gets clobbered. Gating on a click means the model is always
  // loaded by the time we ask for a camera move — no race, no retry loop.
  const [started, setStarted] = useState(false);

  /* LEAVING MID-DEAL ASKS FIRST (author, 2026-08-05: "when i clicked 'call it'
   * and went to the slider and then went to the top left button… i am exited
   * from the game… could be a mistake for other players").
   *
   * THIS IS A HAZARD I INTRODUCED EARLIER TODAY. The same button used to be an
   * 11px hairline in the corner that the author reported as easy to miss; making
   * it findable also made it findable BY ACCIDENT, and it is one click from
   * discarding a run with no undo — the run lives in component state, so the
   * deal, the presses spent and the call are gone the moment it unmounts.
   *
   * ARMED, NOT MODAL. A dialog would have to be portaled past .ps-root's
   * pointer-events:none and would take the floor hostage at the exact moment the
   * player is deciding something; the button changing into its own question
   * costs one click, blocks nothing, and cannot be missed because it is the
   * thing under the cursor. It disarms itself after four seconds, so a stray
   * first click leaves no trap primed under a later real one.
   *
   * ONLY WHILE THERE IS SOMETHING TO LOSE. Before the pitch starts there is no
   * run, and at AUTOPSY the deal is resolved and read — both exit on one click,
   * as they always did. The guard covers FLOOR, ALLOCATION and RESOLUTION: mid
   * pitch, at the slider, and after the call but before the post-mortem. */
  const [exitArmed, setExitArmed] = useState(false);
  const exitTimer = useRef(null);
  const exitAtRisk = started && run.phase !== PHASE.AUTOPSY;
  useEffect(() => () => clearTimeout(exitTimer.current), []);
  // Something resolved or reset under us — never leave the trap primed.
  useEffect(() => { if (!exitAtRisk) setExitArmed(false); }, [exitAtRisk]);
  const handleExit = useCallback(() => {
    if (!exitAtRisk || exitArmed) { onExit?.(); return; }
    setExitArmed(true);
    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setExitArmed(false), 4000);
  }, [exitAtRisk, exitArmed, onExit]);

  const [speaking, setSpeaking] = useState(false);
  /* WHOSE VOICE IS IN FLIGHT — the flat surface has needed this all along (see
     its `speakingAs`) and desktop did not, because every mouth here belongs to
     something in the room that the camera was already pointed at. Virgil breaks
     that: his mouth is a 2D player floating over the scene, so the panel has to
     know it is HIM speaking and not merely that somebody is. */
  const [speakingAs, setSpeakingAs] = useState(null);
  // HOW MUCH OF VIRGIL HAS BEEN SPOKEN on this claim — 0 none, 1 his read, 2
  // the consequence. Driven by the claim turn's onPart so his panel can never
  // show a line the voice has not reached. See VirgilRead's `reveal`.
  const [virgilAt, setVirgilAt] = useState(0);
  // COLLAPSED BY DEFAULT (author, 2026-08-05: "very busy text panel, often
  // current dialogue is not even highlighted or visible").
  //
  // Open, this is the largest of the three blocks in the column and it grows a
  // claim at a time, so by claim 2 the record of what was said was taller and
  // brighter than the thing being said — and .ps-readcol scrolls as a whole, so
  // the live claim was pushed off its own top edge. The screenshot that reported
  // this has the current claim clipped mid-sentence with a full transcript and a
  // full Virgil panel legible beneath it.
  //
  // The old rationale — "a panel you have to discover first mostly doesn't get
  // discovered" — survives the change, because collapsing is not hiding: the
  // header stays up with the count and the control ("ON THE RECORD · 2 of 6 ·
  // show"), so it advertises both that it exists and that there is something in
  // it. What it stops doing is outranking the live claim by default.
  const [script, setScript] = useState(false);
  const screenRef = useRef(null);
  // One board per seat, each painted onto that character's OWN monitor in the
  // scene via the evidenceActive handshake. Eugene has none — he never stamps.
  const screensRef = useRef({});

  // THE ARRIVAL. `rolled` gates the panel's CTA: the record is signed, THEN you
  // let the agent pitch. Two beats, because watching the appointment land is the
  // moment the session starts belonging to you. (Named `rolled` from the dice
  // era; it is the arrival now — renaming it touches both surfaces for nothing.)
  const [rolled, setRolled] = useState(false);
  const [rolling, setRolling] = useState(false);
  // NOTHING ON THIS PANEL MAY NAME THE DEAL BEFORE THE RECORD IS SIGNED
  // (invariant 7). Printing "ALDERMAN · $ALDR · $7.5M" and "Connor brought
  // this one in" over an empty table announced both the deal and the speaker
  // before either had been picked — precisely the reveal this beat exists to
  // stage.
  //
  // Under the card deal these were two separate gates, because the deal card
  // and the speaker's card turned over at different moments. One arrival has one
  // settle, so they're now the same instant and the two names arrive together.
  const [settled, setSettled] = useState(false);
  const identity = rolled || settled;
  // The desk's caseload, not a roll — peeked here, committed when the file is
  // opened. See peekFileNo in engagement.jsx. The ref is the once-per-sitting
  // commit guard: rolling/rolled are React state and can double-pass in one
  // event batch.
  const [fileNo] = useState(() => peekFileNo());
  const fileCommitted = useRef(false);
  const recordRef = useRef(null);
  const clientRef = useRef(null);
  const stampRetainedRef = useRef(null);
  const particularsRef = useRef(null);
  const coverRef = useRef(null);
  const tlRef = useRef(null);

  const claim = currentClaim(run, deal);
  const onFloor = started && run.phase === PHASE.FLOOR;

  /* ---- the opening ----
     HEAR THE PITCH used to cut straight to claim 1, so the bot arrived already
     mid-argument: "appears to be speaking in the middle of the pitch with no
     intro" (author, 2026-08-02). It now says who it is here for and how it is
     paid before it starts selling — see PITCH_OPENING in desk.js for why the
     commission line in particular is worth the seconds.

     THE ROOM STAGES ON `onFloor`, THE UI ON `floorLive`. Those are deliberately
     different gates: the bot has to walk in, take the frame and start talking
     during the opening — that IS the beat — while the claim body, the seat row
     and the progress rail have nothing to say until it makes its first claim.
     Gating the room on this too would leave you looking at an empty desk while a
     voice talked at you. */
  const openingLines = useMemo(() => pitchOpening(deal), [deal]);
  const [openingAt, setOpeningAt] = useState(-1);
  // THREE STATES, NOT TWO. `openingDone` is the remarks having FINISHED;
  // `opened` is the floor having been handed back. They used to be the same
  // instant — see the gate note on OpeningBody — and the beat between them is
  // now a button. Both surfaces hold this seam the same way or they drift.
  const [openingDone, setOpeningDone] = useState(false);
  const [opened, setOpened] = useState(false);

  /* THE BRIEFING CAN BE PUT DOWN (author, 2026-08-05: "can you also make the
   * engagement.js screen dismissable?").
   *
   * DISMISSED, NOT SKIPPED — the distinction matters, because the panel already
   * had a way forward. REVIEW THIS DEAL / HEAR THE PITCH is how you LEAVE the
   * briefing, and a second control that also left it would be one beat with two
   * exits. What there was no way to do is get the panel out of the way and look
   * at the room it is describing: four analysts at their desks, a pitch bot
   * standing in the middle of them, all of it behind an opaque sheet of copy.
   *
   * So this hides and restores, and starting the pitch stays exactly where it
   * was. The brief is never destroyed — the restore chip is rendered in the same
   * breath as the hide, so there is no state in which the deal sheet is gone and
   * nothing brings it back. */
  const [briefHidden, setBriefHidden] = useState(false);
  const floorLive = onFloor && opened;

  /* ---- the briefing, which comes BEFORE the opening ----

     Virgil explains the house rules — six claims, three follow-ups, one deep
     check each, what the slider does — and then the bot pitches. It is the same
     three-state seam as the opening (playing / finished / handed on) and it
     reuses OpeningBody, so the two beats cannot drift on reveal or skip.

     WHY IT PLAYS ON THE FLOOR rather than on the arrival panel, where a tutorial
     more obviously belongs: his mouth is a SitePal player that only mounts with
     the floor (see the .ps-virgil block), so anywhere earlier he speaks with no
     face. The bot is staged and silent for these ~50 seconds, which reads as it
     waiting its turn.

     RESOLVED IN AN EFFECT, NOT IN THE INITIALISER. briefingMode() reads
     localStorage and the query string; running that during render would give the
     server a different answer than the client. Until it resolves `briefLines` is
     empty and the effect below no-ops, which costs nothing — the floor is behind
     a click and this settles on mount. */
  const [briefMode, setBriefMode] = useState(null);
  const [briefAt, setBriefAt] = useState(-1);
  const [briefDone, setBriefDone] = useState(false);
  // `briefed` is the OPENING'S gate: the bot may not start until the cat is done
  // or has been waved off. It starts false and the "off" mode flips it on mount.
  const [briefed, setBriefed] = useState(false);
  const briefLines = useMemo(
    () => (briefMode && briefMode !== "off" ? briefing(briefMode === "short") : []),
    [briefMode]);

  useEffect(() => {
    const m = briefingMode();
    setBriefMode(m);
    if (m === "off") setBriefed(true);
  }, []);

  /* ---- the evidence screen ----
     We don't own a texture. VideoScreens already owns the seat's mesh, canvas
     and material; we borrow the canvas through the EvidenceScreens handshake
     and hand it back on unmount. See evidenceScreen.js for why. */
  useEffect(() => {
    const s = createEvidenceScreen({ station: SPEAKER_STATION,
                                     header: PITCH_BOT.name.toUpperCase() });
    screenRef.current = s;
    // THE PITCHER HAS NO MONITOR OF ITS OWN. There are four screens in this room
    // and, since 2026-07-29, four analysts to own them — the agent is an outsider
    // projected into the room. It has no evidence surface of its own: the easel it
    // briefly had was removed from the glb on 2026-07-29, so PITCHER and Barron
    // ALIAS one screen (station "demon" === SPEAKER_STATION, which was Barron's
    // all along) because creating two screens for one canvas makes them fight
    // over __screen2Canvas. A surface for the pitcher's own receipts is still
    // open — the projector is the obvious candidate.
    const made = { [PITCHER]: s, [SEATS.BARRON]: s };
    for (const seat of SPENDABLE_SEATS) {
      if (seat === SEATS.BARRON) continue;   // aliased above
      made[seat] = createEvidenceScreen({
        station: DESK[seat].station,
        header: DESK[seat].name.toUpperCase(),
      });
    }
    screensRef.current = made;
    return () => {
      Object.values(screensRef.current).forEach((x) => x.dispose());
      screensRef.current = {}; screenRef.current = null;
    };
  }, []);

  // Report the floor to the host so the room can stage for it (the pitch bot's
  // visibility hangs off this). Its own effect so the callback identity can't
  // drag the camera effect's deps around.
  useEffect(() => {
    onFloorChange?.(onFloor);
    return () => onFloorChange?.(false);
  }, [onFloor, onFloorChange]);

  /* ---- camera + animation: he's talking, so look at him ---- */
  useEffect(() => {
    if (!onFloor) return;
    onFocusAgent?.(PITCHER_AGENT);
    setScreenLook(false);   // camera is off any screen — see screenLook
  }, [onFloor, run.claimIndex, onFocusAgent]);

  /* ---- the post-deal panel gets the room back ----
     NOTHING RELEASED THE CAMERA WHEN THE FLOOR ENDED. Focus was only ever SET,
     by the effect above and by sayTurn's per-utterance handover, so the autopsy
     opened wherever the last press had parked it — pressed Eugene last, and the
     summary played over a close-up of Eugene. The screenshot that prompted this
     was the pitch bot's LEGS, head cropped, the room out of frame entirely
     (author, 2026-08-02).

     'Reset' rather than null: null clears the target and leaves the camera
     exactly where it is — see the note on that branch in CyborgTempleScene.

     AUTOPSY ONLY, deliberately. RESOLUTION has its own staging (onRevealChange
     hands the host a curtain call and the four stand up for it), and pulling
     back underneath that would fight it; the wide shot belongs to the beat AFTER
     the reaction, where the panel is the screen and the room is the backdrop. */
  useEffect(() => {
    if (run.phase !== PHASE.AUTOPSY) return;
    onFocusAgent?.('Reset');
  }, [run.phase, onFocusAgent]);

  // SPEECH STATE NOW FOLLOWS ACTUAL AUDIO. It used to be pinned true for the
  // whole floor, which told the room "still talking" through every silence — the
  // bot's talking clip would have run for four minutes straight.
  //
  // AND IT NAMES THE PITCHER, NOT "SOMEBODY". This flag is the PITCH BOT's mouth
  // and talking clip; `speaking` spans the whole sayTurn chain, which since
  // 2026-08-03 also carries Virgil and, since the seats got faces, their answers
  // too. So the bot mouthed along to every other character in the room —
  // "pitchbot and virgil appeared to speak virgil's lines" (author, 2026-08-04).
  // The 2.4s beat before the cat made it obvious rather than causing it: the bot
  // had been chewing through his lines all along, just tightly enough to read as
  // one continuous speaker.
  useEffect(() => {
    onSpeechActive?.(onFloor && speaking && speakingAs === VOICE);
    return () => onSpeechActive?.(false);
  }, [onFloor, speaking, speakingAs, onSpeechActive]);

  /* ---- a claim takes the floor, then becomes pressable ---- */
  useEffect(() => {
    if (!floorLive) return;
    setClaimVisible(false);
    const t = setTimeout(() => setClaimVisible(true), 260);
    return () => clearTimeout(t);
  }, [run.claimIndex, floorLive]);

  /* ---- reveal: hand the outcome to the host so the room plays it ---- */
  useEffect(() => {
    if (!onRevealChange) return;
    if (run.phase !== PHASE.RESOLUTION) { onRevealChange(null); return; }
    const correct = (run.call?.p ?? 0.5) > 0.5 === (deal.truth === 1);
    onRevealChange(run.call?.v === 0 ? "abstained" : correct ? "aligned" : "missed");
    return () => onRevealChange(null);
  }, [run.phase, run.call, deal.truth, onRevealChange]);

  /* ---- the deal ---- */
  useEffect(() => { Object.values(SFX).forEach(preloadSfx); }, []);
  useEffect(() => () => endArrival(tlRef.current), []);

  const runRoll = useCallback(() => {
    if (rolling || rolled) return;
    // The file is being opened either way — the caseload counts it either way.
    if (!fileCommitted.current) { fileCommitted.current = true; commitFileNo(); }
    // Someone who asked not to be moved gets the deal, not the choreography.
    if (prefersReducedMotion()) { setSettled(true); setRolled(true); return; }

    setRolling(true);
    const tl = runArrival({
      record: recordRef.current,
      client: clientRef.current,
      clientText: deal.name,
      stampRetained: stampRetainedRef.current,
      particulars: particularsRef.current,
      onSettled: () => setSettled(true),
      onDone: () => { setRolling(false); setRolled(true); },
    });
    // Nothing to animate — go straight to the rolled state rather than
    // stranding the player on a button that does nothing.
    if (!tl) { setRolling(false); setSettled(true); setRolled(true); return; }
    tlRef.current = tl;
  }, [rolling, rolled]);

  // Impatience is a legitimate input: a click anywhere mid-arrival completes it
  // instantly instead of making you sit through it.
  const skipRoll = useCallback(() => {
    if (rolling) skipArrival(tlRef.current);
  }, [rolling]);

  /* ---- it says it out loud ----
     Token-guarded, and the guard is not optional: a press interrupts the claim
     mid-sentence, so two utterances are briefly in flight. The one being cut off
     resolves through stopAdviserAudio and would otherwise land its `finally`
     AFTER the reply started, reporting "stopped" over live audio and dropping the
     room back to a non-speaking idle for the whole answer. Only the newest
     utterance may say it has stopped. (Learned on PressFlat; ported verbatim.) */
  const sayToken = useRef(0);

  /* ---- ONE WAY TO MAKE THE ROOM QUIET ----
   *
   * Two reports, 2026-08-05: "i did occasionally get virgil talking over
   * pitchbot when i skipped intros, and i also one time had the pitchbot still
   * talking after i had moved on to the gauge page."
   *
   * They are the same defect at two severities, and the second one is not a race
   * at all — `callIt` moved the run to ALLOCATION without touching audio, so
   * whatever the pitcher was mid-sentence on simply carried on over the gauge.
   * Deterministic, and it survived because the stopping was copy-pasted at five
   * call sites and any transition that forgot to paste it got nothing. skipBrief
   * had pasted two of the three and was leaving Eugene's beat running.
   *
   * THE ABORT CONTROLLER IS THE PART THAT FIXES THE RACE. The token alone cannot:
   * it stops the CHAIN from advancing, but a line already inside speakLine is
   * between a fetch and a play, and stopVirgilLine() aimed at audio that has not
   * started yet is a no-op that the fetch then resolves straight past. Both
   * speakAdviserLine and speakVirgilLine already took a `signal` and nothing here
   * had ever passed one. Aborting closes the window where it is widest — the
   * network — so a skipped line is cancelled before it can become sound.
   *
   * Returns the fresh token so a caller starting a new chain can use it.
   */
  const sayAbort = useRef(null);
  const silence = useCallback(() => {
    sayAbort.current?.abort();
    sayAbort.current = null;
    // ALL THREE, ALWAYS. Eugene routes through playUnicornBeat, Virgil through a
    // SitePal portal, everyone else through the shared audio element, and a
    // caller that remembers two of them is the bug this function exists to make
    // unwriteable.
    try { stopAdviserAudio(); } catch {}
    try { stopVirgilLine(); } catch {}
    try { stopUnicornBeat(); } catch {}
    return ++sayToken.current;
  }, []);

  // ONE SPEECH PATH. A second helper lived here — a single-utterance `say` calling
  // speakAdviserLine directly — and it survived the two-voice rewrite as the
  // claim-spin caller. Two functions both claiming `sayToken` and both flipping
  // `speaking` is the exact shape the token guard exists to prevent, so the spin
  // now goes through sayTurn as a one-part turn. It gets the camera handover free.

  // A claim takes the floor -> it speaks the spin, from the pitcher's own frame.
  // `floorLive`, not `onFloor`: while the opening is playing the pitcher already
  // has the mouth, and starting the first claim underneath it would put two
  // utterances in flight from the same speaker — the exact collision sayToken
  // exists to arbitrate, except here BOTH would be legitimate.
  /* ---- AND THEN THE CAT ----
     The pitcher makes the claim; Virgil reads the runway on it, and the camera
     crosses to him for it under this file's own rule (THE CAMERA FOLLOWS THE
     VOICE). The ORDER is the point: the agenda ("two more money questions after
     this one") is the input to the decision the claim has just posed, so it lands
     after you have heard what you are deciding about rather than over the top.

     THE AGENDA, NEVER THE TIP. Only one of his two lines is spoken, and it is the
     one that stays on under the mute switch (virgil.js: "the half that stays
     ON"). The tip is a written aside about the SHAPE of the argument, read at
     your own pace; speaking it would turn the floor into a tutorial reading
     itself out loud.

     SILENT WHEN THE TIPS ARE OFF — a change to what that switch means, and the
     honest one now that he has a throat: "Virgil stops chiming in" is the
     design's own phrasing, and a cat you have muted who still talks six times a
     session reads as a broken toggle. His agenda TEXT is untouched.

     `virgil` and `tips` are declared several hundred lines below this effect and
     that is safe rather than lucky: the callback body only ever runs after the
     commit, by which point every const in the component scope is initialised. It
     reads the values from the render that CHANGED THE CLAIM, which is exactly the
     agenda this claim is owed. */
  useEffect(() => {
    if (!floorLive || !claim) return;
    // A new claim starts with none of him said — otherwise claim 2 inherits
    // claim 1's level and his read is on screen before the bot opens his mouth,
    // which is the exact thing `reveal` exists to stop.
    setVirgilAt(0);
    sayTurn(
      [
        /* IT SAYS WHAT THE POINT IS BEFORE IT ARGUES IT. The turn used to open
           on `claim.spin` — so however well the column read, what you HEARD was
           still an inference with nothing in front of it ("i got the same
           unadorned claim", author 2026-08-04). Printing the lead and not
           speaking it fixed the page and left the performance exactly as it was.
           Its own part rather than a longer string: the mouth, the dwell floor
           and the skip token all work per utterance, and one 200-character line
           would hold the camera through a single unbroken breath. sayTurn drops
           parts with no text, so a slot without a lead is a no-op here. */
        { voice: VOICE, text: claim.lead, agent: PITCHER_AGENT },
        /* AND IT SAYS THE CHECKABLE PART OUT LOUD (author, 2026-08-05: "the
           claim fact shouldn't be withheld as text only").

           This is the same defect the note above fixed, one element further
           along. The column has printed SUBJECT → FACT → SPIN since 2026-08-04,
           but the voice ran lead → spin: the audio skipped the middle thing the
           page was showing, so the FACT row read as a line the bot ought to have
           said and somehow hadn't — "just surfaced in the text only".

           IT WAS ALWAYS THE BOT'S. pu-fact's own note settles the ownership —
           it is "the part of what the bot just said that you could actually go
           and check", and it is explicitly NOT Virgil's, because he is mutable
           and nothing checkable may sit behind the tips switch. A line the
           design calls part of an utterance should be in that utterance.

           THE TAG STAYS AND DOES THE SEPARATING. Speaking it does not make it
           less stipulated: FACT is the promise that the bot never lies, which is
           what stops three questions being spent hunting one. Heard, the fact and
           the inference arrive adjacent in one voice — which is the experience
           being simulated; read, the tag and the rule hold them apart — which is
           the analysis. That split is the point, not a problem to fix.

           Its own part, for the reason the lead is: the mouth, the dwell floor
           and the skip token all work per utterance. sayTurn drops parts with no
           text, so a slot with no fact stays a no-op. */
        { voice: VOICE, text: claim.fact, agent: PITCHER_AGENT },
        { voice: VOICE, text: claim.spin, agent: PITCHER_AGENT },
        /* NO `agent` ON HIS PART, deliberately — the one exception to this
           file's THE CAMERA FOLLOWS THE VOICE rule, and the rule's own logic is
           what makes it one. Cutting to a speaker is worth doing because you
           then watch them say it; the glb cat has no face mesh to lip-sync on,
           so flying to him buys a close-up of a mute animal while his voice
           comes out of a panel somewhere else. The camera holds on the pitcher
           and .ps-virgil carries him instead. */
        // THE TIP, NOT THE AGENDA — see the long note at the same effect in
        // PressFlat. Both surfaces speak the same half of the cat or they drift.
        // leadMs: he waits for the bot to finish and THEN says his piece. Same
        // number on both surfaces, for the same reason the tip is.
        { voice: VIRGIL.voice, text: tips ? virgil?.tip : "", leadMs: VIRGIL_BEAT_MS, minMs: 700 },
        /* THEN WHAT YOU CAN DO ABOUT IT. Its own part, following his read with a
           short beat rather than the full VIRGIL_BEAT_MS — that constant is the
           gap between two DIFFERENT speakers ("somebody having listened and then
           answered"), and this is the same cat carrying on, so the same pause
           would read as him losing his thread. See nextMove in virgil.js. */
        { voice: VIRGIL.voice, text: virgil?.nextMove, leadMs: 500, minMs: 700 },
      ],
      /* HIS TEXT ARRIVES WHEN HIS VOICE DOES. `reveal` levels are keyed off the
         part index: 0-2 are the bot's three utterances, so nothing of the cat is
         on screen while the bot still has the floor; 3 is his read, 4 the
         consequence. sayTurn calls onPart AFTER each part's leadMs, which is
         exactly right — the 2.4s beat before he speaks should be silence with
         nothing new to read, not a panel that has already said it.
         Index rather than a flag on the part: onPart's contract is the index,
         and hoisting the array to name the parts would fork a literal both
         surfaces keep deliberately identical. If a part is ever inserted before
         his, these two numbers move. */
      { onPart: (i) => setVirgilAt(i >= 4 ? 2 : i >= 3 ? 1 : 0) },
    );
    return () => { silence(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorLive, run.claimIndex]);

  useEffect(() => () => { silence(); }, [silence]);

  /* ---- TWO VOICES PER PRESS ----
     The seat that went and looked speaks FIRST, in ITS OWN voice; the pitcher
     reacts after. The build order called this ordering out while it was still
     unbuilt and warned what happens if it is wrong — "the reaction lands under
     the wrong name" — and the wrong version was worse than that: the floor
     voiced EVERY line as the pitcher, so pressing Eugene came back as the bot
     reading Eugene's finding (author, 2026-07-29). Shipped, so VC_GAME.md no
     longer carries the item.

     One token spans BOTH utterances. If a press interrupts mid-turn, the guard
     must cover the whole exchange or the abandoned adviser line clears `speaking`
     while the new pitcher line is still playing. */
  /**
   * ONE LINE, ROUTED TO WHICHEVER MOUTH THAT CHARACTER ACTUALLY HAS.
   *
   * EUGENE IS THE EXCEPTION, and it is not an arbitrary one: on this surface he is
   * the glTF unicorn in the room, and his lip-sync is a JAW BONE driven by
   * playUnicornBeat's RMS analyser through lib/trade/unicornMouth. Clicking him in
   * the lobby has always run that path; the press floor was routing him through
   * speakAdviserLine instead, which writes `adviserMouth.EU` — a channel nothing
   * in this scene reads. So he spoke in-game with a closed mouth while the very
   * same character moved his jaw fine one screen earlier (author, 2026-07-29).
   *
   * "THE ANALYSTS ARE STATIC IN-ROOM" WAS TRUE AND IS NOT ANY MORE, which is what
   * the third branch below is for. Marisol, GR80 and Connor each have a real
   * SitePal face in this room — the room paints their player's canvas onto their
   * `*_Face2` mesh whenever the camera focuses them, which the press already
   * causes. What was missing was anybody telling that player to SAY anything: a
   * line went to speakAdviserLine, which plays our own <audio> and writes
   * `adviserMouth`, a channel this scene has no reader for. So you heard her,
   * the camera cut to her, and her projected face never moved (author,
   * 2026-08-04). The flat surface never had the bug because its speakLine takes
   * a SEAT and hands it to speakSeatLine; this one only ever took a voice.
   *
   * SAME sayText AS MOBILE, DIFFERENT PLAYER — see the long note over
   * speakSeatOnTempleHost for why a per-seat portal is the wrong answer on a
   * surface whose faces are meshes.
   *
   * DELIBERATELY DESKTOP-ONLY, all of it. PressFlat has no unicorn and no room —
   * no 3D at all — so it keeps its own routing. These are presentation
   * differences, not rules, which is exactly what §6 says belongs in the surface.
   */
  /* `signal` REACHES THE TWO PATHS THAT FETCH. It is threaded, not stored, so a
   * line always carries the controller of the chain that started it — a chain
   * superseded mid-fetch aborts its own request and cannot arrive late over the
   * chain that replaced it. The host-face and unicorn paths take no signal (they
   * talk to a live player rather than the network); their stops are synchronous
   * and land inside `silence`. */
  const speakLine = useCallback(async (voice, text, seat = null, signal = undefined) => {
    if (voice === "EU") {
      // Same hooks the lobby passes, so the horn glow comes along with the jaw.
      await playUnicornBeat({ line: text }, { setGlow: setUnicornGlow });
      return;
    }
    /* VIRGIL IS THE SECOND EXCEPTION, and a different KIND of one. Eugene's
     * mouth is a jaw bone on a rig already in this room; Virgil's is a SitePal
     * player, and the glb cat cannot carry one — there is no face mesh on
     * fluffyCat.glb to project onto, which is why the 2D player exists at all.
     * speakVirgilLine falls back to speakAdviserLine on its own when the portal
     * is not up, so this branch cannot lose a line.
     *
     * WHETHER HIS PLAYER IS EVEN MOUNTED ON THIS SURFACE IS A SEPARATE QUESTION —
     * PressFigure hosts it, and that is the flat surface's panel. Here the branch
     * is harmless and correct in advance: it resolves to the same ElevenLabs path
     * desktop already used, and starts moving his face the moment a tile exists. */
    if (voice === VIRGIL.voice) {
      await speakVirgilLine(text, { signal });
      return;
    }
    /* A SEAT WITH A FACE IN THIS ROOM SPEAKS THROUGH IT. Engine 14 is that
     * seat's ElevenLabs voice AND its lip-sync in one call, so this buys the
     * mouth without changing how she sounds — DESK[seat].sitepal.voice.voice is
     * the same id /api/counsel-voice would have used, which verify-press-run
     * asserts precisely so the two routes can never drift.
     *
     * FALLS THROUGH ON FAILURE rather than returning. The host declines silently
     * in several ways (no embed, wrong scene, muted) and every one of them must
     * still produce a spoken line: a seat that says nothing reads as a bug, a
     * seat that says it without moving reads as a still. Same trade the flat
     * surface makes inside speakSeatLine. */
    if (seat && seatHasHostFace(seat)) {
      // AWAITED, THEN TESTED — in that order, and the order is the bug it fixed.
      // This is an async function, so the promise it returns is truthy even when
      // it resolves false; testing the promise took the host path unconditionally
      // and could never fall back. It resolves TRUE having held for the length of
      // her line, or FALSE if the host declined or its player never came up — and
      // false has to reach our own audio, or the answer is simply never spoken.
      if (await speakSeatOnTempleHost(seat, text)) return;
    }
    await speakAdviserLine(voice, text, { signal });
  }, []);

  /**
   * @param opts.onPart  called with the index of each part AS IT STARTS. The
   *   opening reveals its lines in step with the voice; without this it would
   *   have to print the whole block up front, which is the "already mid-pitch"
   *   complaint in a different costume.
   * @param opts.dwell   (text) => ms, overriding MIN_DWELL_MS per part. The
   *   default 900ms is a CAMERA floor — long enough for a cut to read as a cut.
   *   The opening needs a READING floor instead: its lines are ~140 characters
   *   and, with no API key, speakLine resolves instantly, so a 900ms hold would
   *   flash three sentences past in under three seconds.
   * @param opts.onDone  fired ONLY when the chain finishes without being
   *   superseded — it sits inside the token guard for that reason. Hands the
   *   camera back to the pitcher after Virgil's line; a press mid-turn bumps the
   *   token, and pulling the camera off the seat that is about to report would
   *   undo the cut the press just made.
   *
   * A part may carry its own `minMs` to override both.
   *
   * A part may also carry `leadMs` — SILENCE HELD BEFORE IT, which is not the
   * same job as `minMs`. `minMs` pads the end of a line so the beat can be read;
   * `leadMs` is the gap between two speakers. The cat used to come in on the
   * pitcher's last syllable ("Virgil starts speaking too quickly after pitchbot
   * ends", author 2026-08-04), which reads as an interruption rather than as
   * somebody weighing what was just said. Nothing plays during the hold and
   * `speakingAs` still names the PREVIOUS voice, so his panel does not light up
   * until he actually starts.
   */
  const sayTurn = useCallback(async (parts, { onPart = null, dwell = null, onDone = null } = {}) => {
    const live = parts.filter((p) => p && p.text);
    if (!live.length) return;
    /* STARTING A CHAIN SILENCES THE ONE BEFORE IT. sayTurn used to bump the token
       and nothing else, which stops the old chain ADVANCING but leaves its
       current line audible until the new line's audio happens to start — the gap
       the press path had already noticed and was patching locally ("stopping
       here means the room never carries two voices across the gap"). Doing it
       here means every caller gets that, not just the one that remembered. */
    const token = silence();
    const ctl = new AbortController();
    sayAbort.current = ctl;
    setSpeaking(true);
    try {
      for (let i = 0; i < live.length; i++) {
        const p = live[i];
        if (sayToken.current !== token) return;   // superseded — stop the chain
        // THE CAMERA CUTS BEFORE THE PAUSE, NOT AFTER — kept identical to
        // PressFlat's, where the report came from ("the pitchbot appear[s] for a
        // few seconds, and then virgil pops up. Then, a long pause"). The move
        // used to sit below the leadMs wait, so the beat played on whoever was
        // already in frame and the incoming rig started warming only at
        // speakLine. Moved above it, the pause plays on the arriving face and
        // the rig gets the beat as a head start.
        //
        // THE CAMERA FOLLOWS THE VOICE, NOT THE PRESS. It used to cut to whoever
        // answered and then sit there while the PITCHER replied — so you watched
        // Eugene's back through the agent's whole line (author, 2026-07-29). Each
        // utterance owns the frame while it plays, which is what "on a press it's
        // the camera that crosses the room" was always supposed to mean.
        if (p.agent) onFocusAgent?.(p.agent);
        setSpeakingAs(p.voice || VOICE);
        // THE GAP BEFORE THIS VOICE. Re-checked after the wait: two or three
        // seconds is long enough for a press to have landed, and resuming into a
        // superseded chain would put the cat over whoever interrupted him. The
        // camera having already moved is not a leak — whoever supersedes this
        // chain sets it to their own seat on their first part.
        if (p.leadMs) {
          await new Promise((r) => setTimeout(r, p.leadMs));
          if (sayToken.current !== token) return;
        }
        // AFTER the wait, still: the lead is dead air BEFORE a line, so the text
        // must not appear during it. Only the face arrives early.
        onPart?.(i);
        /* THE CAT WATCHES THE BOT (author, 2026-08-05). Issued per part and held
           for the length of the line, because SitePal drops a gaze when its
           duration lapses — one that expires mid-claim snaps his head back,
           which reads worse than never having turned at all.
           HIS OWN LINES ARE NOT INCLUDED and need no undoing: SitePal releases
           the gaze the moment a character is asked to speak, and faceVirgilFront
           runs inside speakVirgilLine besides.
           THE PITCHER ONLY, not every other voice. The analysts sit at their own
           desks in their own directions, and a single screen-right turn aimed at
           centre stage would be wrong for all of them — see the studio's warning
           that gaze degrees are per-scene. Watching the analysts too is a real
           enhancement, but it needs a direction per seat, not this one. */
        if ((p.voice || VOICE) === VOICE) {
          try { virgilWatchPitcher({ seconds: lineSeconds(p.text) }); } catch {}
        }
        const startedAt = Date.now();
        // `seat` is optional and only a press ever sets it — the opening, the
        // claim spins and the pitcher's reactions have no seat and route to
        // their own rigs exactly as before.
        try { await speakLine(p.voice || VOICE, p.text, p.seat, ctl.signal); }
        catch { /* voice is enrichment, never a gate on play */ }
        /* THE BACKSTOP. The signal closes the network window; this closes what is
           left of it. speakAdviserLine still has to decode the bytes it already
           has, and the host-face and unicorn paths never saw a signal at all — so
           a line CAN still reach playback a beat after being superseded. If the
           token moved while this one was resolving, stop everything again and
           leave. Cheap, idempotent, and it converts "occasionally two voices"
           into "at most a fragment". */
        if (sayToken.current !== token) {
          try { stopAdviserAudio(); } catch {}
          try { stopVirgilLine(); } catch {}
          try { stopUnicornBeat(); } catch {}
          return;
        }
        // A DWELL FLOOR, because the camera move is now tied to audio that may
        // not arrive. With no API key speakLine resolves almost instantly and the
        // two cuts collapse into one strobe across the desk; the shot has to hold
        // long enough to read as a shot even in silence.
        const left = (p.minMs ?? (dwell ? dwell(p.text) : MIN_DWELL_MS)) - (Date.now() - startedAt);
        if (left > 0) await new Promise((r) => setTimeout(r, left));
      }
    } finally {
      if (sayToken.current === token) { setSpeaking(false); onDone?.(); }
    }
  }, [onFocusAgent, speakLine, silence]);

  /* ---- it introduces itself ----
     Runs once per session, on the first frame of the floor. No cleanup that stops
     audio: on a natural finish there is nothing left playing, and the two ways it
     can end early — SKIP and unmount — are handled by skipOpening and by the
     unmount effect below. Adding one here would race the claim effect, which
     starts speaking in the same commit that `opened` flips. */
  /* ---- the cat briefs you first ----
     Same shape as the opening effect below, and gated so only one of the two can
     ever be speaking: this one runs while `briefed` is false, that one refuses to
     start until it is true.

     THE LEAD IS NOT DECORATION. Virgil is now the FIRST voice of the session, and
     his SitePal player takes a second or two to boot after the floor mounts — the
     tile used to get the bot's whole opening as runway. speakVirgilLine falls back
     to plain audio on its own if the portal isn't up, so the worst case is a line
     read with a still face rather than silence, but a beat here usually avoids
     spending the worst case on the very first thing the player hears. */
  useEffect(() => {
    if (!onFloor || briefed || !briefLines.length) return;
    let alive = true;
    (async () => {
      await sayTurn(
        briefLines.map((text, i) => ({
          voice: VIRGIL.voice, text, seat: VIRGIL.id,
          ...(i === 0 ? { leadMs: VIRGIL_BEAT_MS } : null),
        })),
        { onPart: (i) => { if (alive) setBriefAt(i); }, dwell: readDwellMs });
      if (alive) setBriefDone(true);
    })();
    return () => { alive = false; };
  }, [onFloor, briefed, briefLines, sayTurn]);

  useEffect(() => {
    // `briefed` joins the guard: the bot waits for the cat to finish or be
    // waved off. With ?brief=off it is already true on the first frame.
    if (!onFloor || !briefed || opened || !openingLines.length) return;
    let alive = true;
    (async () => {
      await sayTurn(
        openingLines.map((text) => ({ voice: VOICE, text, agent: PITCHER_AGENT })),
        { onPart: (i) => { if (alive) setOpeningAt(i); }, dwell: readDwellMs });
      // IT STOPS HERE. `opened` is now the player's to flip — see beginPitch.
      // The effect's own guard is still `opened`, so this cannot re-run against
      // the gate: openingDone leaves the block on screen with nothing playing.
      if (alive) setOpeningDone(true);
    })();
    return () => { alive = false; };
  }, [onFloor, briefed, opened, openingLines, sayTurn]);

  // Impatience is a legitimate input here as much as on the arrival (skipRoll).
  // Bumping the token is what supersedes the chain in flight — its `finally` then
  // declines to touch `speaking`, so this has to clear it by hand.
  //
  // SKIP GOES ALL THE WAY THROUGH, gate included. It is already an explicit "move
  // on" — stopping such a player at a button that also says move on is the same
  // click twice. The gate exists for the player who LISTENED to the whole thing.
  const skipOpening = useCallback(() => {
    silence();
    setSpeaking(false);
    setOpeningDone(true);
    setOpened(true);
  }, [silence]);

  // THE GATE ITSELF. Flipping `opened` is what starts the first claim — the claim
  // effect below fires on `floorLive` — so the pitch now begins inside a click.
  const beginPitch = useCallback(() => setOpened(true), []);

  /* THE BRIEFING'S TWO EXITS. Both mark it seen: skipping is still a decision
     ABOUT the briefing, and a player who waves it off does not want it again next
     time. Skip supersedes the chain in flight (the token bump) and clears
     `speaking` by hand, exactly as skipOpening does — its `finally` declines to
     touch state once superseded. */
  const skipBrief = useCallback(() => {
    silence();   // was missing stopUnicornBeat — see the note on silence()
    setSpeaking(false);
    setBriefDone(true);
    setBriefed(true);
    markBriefingSeen();
  }, [silence]);

  const beginBrief = useCallback(() => { setBriefed(true); markBriefingSeen(); }, []);

  /* REPLAY. Only offered before the pitch has the floor — see the note on
     VirgilRead's onReplayBrief for why. Rewinds the beat rather than calling the
     effect: setting `briefed` false is what re-arms its guard. Always the LONG
     version; a player asking for the rules again wants the rules, not the
     one-line reminder they have evidently just failed to act on. */
  const replayBrief = useCallback(() => {
    silence();
    setSpeaking(false);
    setOpeningAt(-1); setOpeningDone(false);
    setBriefAt(-1); setBriefDone(false);
    setBriefMode("long");
    setBriefed(false);
  }, [silence]);

  /* ---- actions ---- */
  // The board updates when the reporter STOPS, not when you press — so the beat
  // has to survive you moving on mid-answer. Holds the claim it is owed to, the
  // same guard the flat surface calls revealFor.
  const replyFor = useRef(null);
  // If the voice is unavailable the beat still exists. Identical to PressFlat's
  // MIN_BEAT on purpose: one exchange, one tempo, on both surfaces.
  const MIN_BEAT = 1400;

  // One path, four seats. Every seat can be sent at every claim — the lane
  // decides DEPTH, not permission. Barron is reusable; the other three are one
  // use each. A send is only ever refused for a reason the player can see: no
  // budget left, or that colleague is already spent.
  const press = useCallback((seat = PITCHER) => {
    if (!floorLive) return;   // nothing to interrupt until it has made a claim
    const next = doPress(run, deal, seat);
    if (next === run) return;
    const outcome = next.outcomes[claim.id];
    setRun(next);
    // THE SEAT REPORTS; THE PITCHER'S REACTION IS NOT PLAYED YET.
    // `stage: "reporting"` until they stop, then "choice" — see AnswerBody and
    // AnswerChoice in pressUi for why the reaction stopped being automatic.
    // A press on the PITCHER has no third party, so there is nothing to choose
    // between: its answer IS the exchange and it plays on the spot.
    const solo = !outcome.adviserSays;
    setFlash({
      id: claim.id,
      seat: outcome.seat,
      board: outcome.board,
      backing: outcome.backing,
      nothingOnFile: outcome.nothingOnFile,
      adviserSays: outcome.adviserSays,
      line: outcome.barronSays,
      stage: "reporting",
      heard: solo,          // its own answer is the thing you already asked for
      looked: false,
      asked: outcome.seat === PITCHER
        ? "Put a number on it."
        : `${seatMeta(outcome.seat).name} — ${seatMeta(outcome.seat).role}`,
    });

    // You INTERRUPTED it — the claim it was mid-way through stops. This was the
    // one site that had spotted the gap and patched it locally, with two of the
    // three stops; sayTurn now silences on every chain start, so the general fix
    // has absorbed it. Kept anyway, and promoted to the full set: the press does
    // several seconds of camera and face-warming work before any new chain
    // begins, and the room should be quiet for all of it.
    silence();

    const owed = claim.id;
    replyFor.current = owed;
    // GET HER FACE READY WHILE THE ROOM IS STILL TURNING. The shared host has to
    // be on this seat's scene before it will accept a line, and a cold swap is
    // seconds. Fired here rather than inside speakLine so it overlaps the camera
    // move and MIN_BEAT, both of which this answer already waits out — the same
    // trick warmSeatPortal plays on the flat surface. Costs nothing when the
    // host is already there, and speakLine falls back if it never arrives.
    if (!solo) warmSeatHostFace(outcome.seat);
    // ONE VOICE, ON ITS OWN CAMERA. The second part of this chain used to be the
    // pitcher's reaction; it now waits behind a button.
    Promise.all([
      sayTurn([solo
        ? { voice: VOICE, text: outcome.barronSays, agent: PITCHER_AGENT }
        : {
          voice: seatMeta(outcome.seat)?.voice,
          text: outcome.adviserSays,
          agent: seatMeta(outcome.seat)?.agentId,
          // Names the seat so speakLine can reach its face — see the third
          // branch there. Without this the line has a voice and no mouth.
          seat: outcome.seat,
        }]),
      new Promise((r) => setTimeout(r, MIN_BEAT)),
    ]).then(() => {
      if (replyFor.current !== owed) return;   // you moved on; the beat is void
      replyFor.current = null;

      // THE ANSWER LANDS ON WHOEVER WENT AND GOT IT — on their own monitor, in
      // the room. That's the whole reason this design is worth the four seats:
      // three boards lit differently at the moment you call it is a picture only
      // this scene can render.
      //
      // DEFERRED TO HERE, as it already was on the flat surface: stamped at press
      // time the receipt appeared on the monitor the camera was moving toward
      // while its owner was still saying "give me a second" — the board answered
      // before the person did, and SEE WHAT LANDED had nothing left to show.
      const board = screensRef.current[outcome.board];
      if (outcome.receipt) board?.stamp(outcome.receipt);
      else if (outcome.nothingOnFile) board?.stampNothing(claim.subject);
      else board?.stayBlack();

      setFlash((f) => (f && f.id === owed ? { ...f, stage: "choice" } : f));

      /* THEN THE CAT CLOSES THE BEAT. The exchange is over and nothing said so
         — see afterAnswer in virgil.js. A fresh sayTurn is safe here because the
         chain above has already resolved; if the player presses on while he is
         talking, the token bump supersedes him, which is the correct outcome.
         Gated on `tips` like his other two voices: muted means muted. */
      /* `tips` and `lastClaim` are declared below this callback, and reading
         them here is safe for the reason the claim effect gives for the same
         thing: the body only ever runs after the commit, by which point every
         const in the component scope is initialised. */
      if (tips) {
        sayTurn([{
          voice: VIRGIL.voice,
          text: virgilAfterAnswer({ lastClaim, index: run.claimIndex }),
          leadMs: VIRGIL_BEAT_MS, minMs: 700,
        }]);
      }
    });
  }, [run, deal, claim, floorLive, sayTurn]);

  /* ---- the two ways to spend the beat ---- */
  // GO AND READ IT. The camera is already on whoever reported — this puts it back
  // if HEAR has since taken it to the pitcher, and it is what marks the outcome
  // as seen, which is the gate on the verdict note and the panel's colour.
  const lookAtBoard = useCallback(() => {
    if (!flash) return;
    /* FLY TO THE SCREEN, NOT TO THE PERSON.
     *
     * This used to focus the reporting seat's own agent — which is where the
     * camera already was, because the press put it there to watch them answer. So
     * the button moved nothing and read as inert, even though the evidence had
     * been stamped onto their monitor a moment earlier by the block above.
     *
     * Screen1..4 are authored poses that frame each desk's primary monitor; they
     * have existed since the monitors became clickable, long before this game.
     * SEE WHAT LANDED wants precisely that shot, so this is a lookup rather than
     * new camera work — see SCREEN_AGENTS.
     *
     * THE PITCHER HAS NO SCREEN OF ITS OWN. Its board aliases Barron's (see the
     * shared `made` map where the screens are created), so a press on the pitcher
     * sends you to the Demon's monitor — which is where its receipt actually is.
     *
     * Falls back to the seat's agent if a station ever has no pose, because
     * flying to the person is a worse shot but not a broken one. */
    const station = flash.board === PITCHER
      ? SPEAKER_STATION
      : seatMeta(flash.board)?.station;
    const screenAgent = station ? SCREEN_AGENTS[station] : null;
    onFocusAgent?.(screenAgent
      || (flash.board === PITCHER ? PITCHER_AGENT : seatMeta(flash.board)?.agentId));
    setScreenLook(true);   // get the column off the receipt — see screenLook
    setFlash((f) => (f ? { ...f, looked: true } : f));
  }, [flash, onFocusAgent]);

  /* PUT THE CHOICE IN VIEW WHEN IT LANDS (author, 2026-08-05: "i had to scroll
   * up to find the button options for Marisol's work").
   *
   * The reading column scrolls with the claim stuck to its top, so an answer
   * arrives BELOW whatever the player was reading — and on a short viewport the
   * buttons at the foot of it can land past the bottom edge, which reads as the
   * control not existing rather than as being one scroll away.
   *
   * Scrolls .pu-choice, not .pu-answer: the buttons are the last thing inside a
   * block that can be taller than the column, so framing the block's TOP is
   * exactly the failure being fixed. "nearest" leaves an already-visible choice
   * where it is instead of jerking it to an edge.
   *
   * An effect and not a call beside the setFlash that causes it, because that
   * one runs inside an async chain with no guarantee React has committed the
   * new stage yet — the element to scroll to may not exist at that moment. */
  /* ESC PUTS THE BRIEF DOWN AND PICKS IT BACK UP. One key, both directions —
   * a dismiss whose undo is only a mouse target is a worse deal than the one the
   * player took. Bound only while the briefing is up, so it cannot shadow an Esc
   * the floor or the autopsy might want later. */
  useEffect(() => {
    if (started) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setBriefHidden((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

  /* THE PAGE TITLE IS NOT OURS TO CLASS (author, 2026-08-05: "Screen appeared
   * with most html overlay suppressed, except the page h1").
   *
   * .custom-title is the gothic headline in app/trade/page.js — it sits OUTSIDE
   * this component's tree, so .ps-readstack.ghost cannot reach it however the
   * class is arranged. An attribute on the document is the smallest thing that
   * crosses that boundary, and the rule for it lives in this file's CSS with
   * every other rule about looking at a screen, rather than as a second
   * definition of "a screen is in focus" over in the page.
   *
   * No hover restore, unlike the reading column: the column holds the claim you
   * may want to check the receipt against, and the title is decoration. */
  useEffect(() => {
    const root = document.documentElement;
    if (screenLook) root.setAttribute("data-press-screenlook", "");
    else root.removeAttribute("data-press-screenlook");
    return () => root.removeAttribute("data-press-screenlook");
  }, [screenLook]);

  const choiceUp = flash?.stage === "choice" && flash?.id;
  useEffect(() => {
    if (!choiceUp) return;
    document.querySelector(".ps-readcol .pu-choice")
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [choiceUp]);

  // LET IT ANSWER. Its own camera, its own voice — the handover sayTurn used to
  // make on its own the moment the adviser stopped.
  const hearReply = useCallback(() => {
    if (!flash?.line) return;
    // AND THE COLUMN COMES BACK. sayTurn flies the camera to the pitcher, so no
    // screen is in focus any more — leaving it ghosted would hide the reply's
    // text for the whole time the reply is being spoken.
    setScreenLook(false);
    sayTurn([{ voice: VOICE, text: flash.line, agent: PITCHER_AGENT }]);
    setFlash((f) => (f ? { ...f, heard: true } : f));
  }, [flash, sayTurn]);

  const advance = useCallback(() => {
    /* Same gap as callIt, one beat shorter: the next claim DOES start a chain,
       so the old voice was cut — but only once the new line's audio arrived,
       which is a camera move and a lead-in later. Silencing on the gesture means
       the room is quiet for that stretch rather than finishing the last thought
       over the top of the new one. */
    silence();
    setScreenLook(false);   // new claim, the column comes back
    // Voids any beat still owed — see replyFor. Without this a board stamped by
    // a press you walked out of lands on the NEXT claim.
    replyFor.current = null;
    setFlash(null);
    Object.values(screensRef.current).forEach((x) => x.stayBlack());
    onFocusAgent?.(PITCHER_AGENT);
    setRun((r) => doAdvance(r, deal));
  }, [deal, onFocusAgent, silence]);

  /* THE FLOOR IS OVER, SO THE FLOOR STOPS TALKING (author, 2026-08-05: "i also
     one time had the pitchbot still talking after i had moved on to the gauge
     page"). This touched no audio at all — not the token, not the three stops —
     and nothing downstream covered for it: ALLOCATION starts no new chain, so
     there was never a superseding sayTurn to cut the old one off. Whatever was
     mid-sentence played out in full over the gauge. Not a race; the one path off
     the floor that had simply never been given the line. */
  const callIt = useCallback(() => {
    silence();
    replyFor.current = null;
    setFlash(null);
    setRun((r) => doCallIt(r, deal));
  }, [deal, silence]);

  const lockCall = useCallback(() => setRun((r) => doAllocate(r, deal, slider)), [deal, slider]);
  const finish = useCallback(() => setRun((r) => toAutopsy(r)), []);

  const options = useMemo(() => seatOptions(run, deal), [run, deal]);
  // What's still coming in this lane — VIRGIL'S AGENDA, and the reason his read
  // is not a restatement of the lane band. VC_GAME.md §3: it "converts the core
  // decision from a coin flip into a decision" — spend the specialist now or
  // never. It was Eugene's free read until the cat took the guidance role
  // ([A§9], virgil.js). Lanes only: it cannot leak the branch.
  const outlook = useMemo(() => laneOutlook(run, deal), [run, deal]);
  // How the pitch is going FOR HIM — a summary of outcomes you've already seen,
  // handed back as posture. The aside is held to the CLAIM so it can't change
  // mid-read; the mood band is live.
  const mood = useMemo(() => pressure(run), [run]);
  const aside = useMemo(
    () => pitcherAside(mood.band, claim, run.claimIndex),
    [mood.band, claim, run.claimIndex]);

  /* THE SAME BAND, ON THE BOT'S FACE.
   *
   * `aside` already turns mood.band into what the pitcher SAYS; this turns the
   * identical value into what he LOOKS like, so the two can never disagree. One
   * source, two surfaces — a face driven from anything else would be a second
   * opinion about the same run, and the one that isn't auditable.
   *
   * `mood.band` and nothing else. Not the claim, not the branch, not
   * `discriminates` — see the tier note in lib/trade/pitchBotExpressions for why
   * that constraint is the whole design and not caution.
   *
   * No-ops until the 3D pitcher is loaded, and on rigs whose face is a texture
   * rather than a mesh set, so this needs no guard for the flat surface.
   *
   * CLEARED ON UNMOUNT so the face doesn't keep last session's posture into the
   * lobby — the bot is hidden there, but it is the same rig and it would be
   * wearing `cornered` the next time the beam came up. */
  useEffect(() => {
    setPitchBotPressure(mood.band);
    return () => setPitchBotPressure(null);
  }, [mood.band]);
  // Reads the run, not just the claim — once you've spent the lane's owner,
  // pointing at them is the same wrong instruction the lane band was giving.
  // VIRGIL, not a seat. `tips` is the player's — the agenda half ignores it.
  const [tips, setTips] = useState(true);
  // DECLARED ABOVE THE MEMO THAT READS IT. It used to sit further down with the
  // other derived flags, which was fine until Virgil's nudge needed it — a
  // useMemo dependency array is evaluated during render, so a `const` below it
  // is a temporal-dead-zone crash rather than a stale value.
  const lastClaim = run.claimIndex >= deal.claims.length - 1;
  const virgil = useMemo(
    () => (claim ? virgilRead(claim, {
      owner: laneOwner(claim), spent: run.advisersSpent,
      remaining: outlook.remaining, tips,
      // The nudge needs the budget so it cannot tell you to spend a follow-up
      // you no longer have, and the index so it rotates. See nextMove.
      pressesLeft: run.pressesLeft, index: run.claimIndex,
      // Once this claim has an outcome the nudge has to stop offering a press.
      answered: !!run.outcomes[claim.id], lastClaim,
    }) : null),
    [claim, run.advisersSpent, outlook.remaining, tips, run.pressesLeft, run.claimIndex,
     run.outcomes, lastClaim]);
  const readout = useMemo(() => callReadout(slider, stakeFor(run)), [slider, run]);
  // The reveal headline. Four bands (callVerdict), not a sign test on the payout.
  const verdict = useMemo(() => callVerdict(run, deal), [run, deal]);
  const read = useMemo(() => coverageScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;
  // Both derived from pressUi/pressRun rather than restated here — restating
  // them per surface is exactly how the two presentations drifted apart.
  const live = pressIsLegal(run, claim);
  // His panel shows only while HE has the audio — not merely while somebody does.
  const speakingVirgil = speaking && speakingAs === VIRGIL.voice;

  /* ------------------------------------------------------------------ */
  return (
    <div className="ps-root">
      <style>{CSS}</style>

      {/* ---------- top bar: always visible, never blocks the room ---------- */}
      <div className="ps-bar">
        {/* "LEAVE THE DESK" UNTIL 2026-08-05, and it named the opposite of what
            it does (author: "you don't really leave the desk, just the game
            opening screen"). onExit is exitPressGame in app/trade/page.js: it
            clears pressMode and nothing else — same page, same room, same desk,
            with the pitch turned off. The desk is where this button LANDS you,
            so the old label promised to take away the one thing it gives back.
            A back control should name its destination, and now it does. */}
        <button className={`ps-exit${exitArmed ? " armed" : ""}`} onClick={handleExit}>
          {exitArmed ? "◀ QUIT? THIS DEAL IS LIVE" : "◀ BACK TO THE DESK"}
        </button>
        {/* The bar names the deal only once the deal has a face. It sits above
            the panel and in bigger type, so leaving it live would spoil the
            reveal more loudly than the headline the panel withholds. */}
        {/* THE REST STATE IS EMPTY SINCE 2026-08-02, and this is the same rule
            engagement.jsx states about its status pill: anything that wants to say
            "not yet" on this surface says it in ONE place. That place is the
            record's pill (under the deal file's cover, whose STATUS line stands
            in for it while the file is closed) — since 2026-08-03 the rail, the
            housing readout and the seal copy no longer carry their copies of it.
            A fifth signal here, in the largest type on screen and outside the
            panel, is what made a waiting surface read as a hung one. It read
            ONE DEAL · NOT IN YET.

            The ARRIVED state is untouched: the bar names the deal once the deal has
            a face, and it is the only place that names it during the floor. */}
        <div className="ps-deal">
          {identity && (
            <>{deal.ticker} · {deal.name} <span className="ps-dim">· {deal.chain}</span></>
          )}
        </div>
        {/* THE METER WAS IMPORTED AND NEVER RENDERED (author, 2026-08-05: "i
            still don't see any reference anywhere to the profit cost for the
            questions"). This file has had `Meter` in its import list the whole
            time; PressFlat renders it, desktop never did. So the price of a
            question — the one number that makes a question a DECISION rather
            than a free action — existed, was correct, was tested, and was only
            ever on the phone.

            IN THE BAR, not the reading column: the column scrolls and is
            ghosted while a screen is in focus, and a cost you have to go looking
            for is the thing being fixed. ON THE FLOOR ONLY — before it there is
            nothing to spend, and at the call the panel's own stakeNote says
            where the size already went. */}
        {onFloor && <Meter run={run} presses={PRESSES} />}
        <div className="ps-book">
          BOOK <b>{Math.round(run.book)}</b>
        </div>
      </div>

      {/* ---------- the opening: the room, then the deal ---------- */}
      {/* THE RESTORE CHIP, rendered as the panel's sibling so it survives the
          panel being hidden — inside .ps-open it would be hidden by the same
          rule it exists to undo. Only while the briefing is up: once `started`
          flips there is no brief to come back to. */}
      {!started && briefHidden && (
        <button className="ps-brief-back" onClick={() => setBriefHidden(false)}>
          ▤ DEAL BRIEF ▸
        </button>
      )}

      {!started && (
        <div className={`ps-open${rolled ? " is-rolled" : ""}${rolling ? " is-rolling" : ""}${briefHidden ? " hid" : ""}`}>
          {/* The roll and the deal sheet fill the left. Copy right, with the
              four portraits beneath it. Nothing in this panel is clickable except
              the one CTA — it is a briefing, not a board. */}

          {/* Mid-arrival, a click anywhere completes it. This has to be a real
              <button> to be clickable at all: .ps-root is pointer-events:none
              and hands input only to buttons and inputs. */}
          {rolling && (
            <button className="ps-skip-deal" onClick={skipRoll} aria-label="Show them in now" />
          )}

          {/* PUT THE BRIEF DOWN — see briefHidden. NOT while `rolling`: the skip
              button directly above is a transparent sheet over the whole panel,
              so a dismiss offered during the arrival is either unreachable or
              steals the click that completes it. The arrival is two seconds and
              already skippable; there is nothing to escape from. */}
          {/* LABELLED, NOT A BARE ✕. There is now a prominent BACK TO THE DESK
              in the opposite corner of the same screen, and a naked glyph next
              to it reads as a second way out rather than as a way to see past
              the panel. Two controls that both mean "get this off my screen"
              have to differ in WORDS, not only in corner. */}
          {!rolling && (
            <button className="ps-brief-hide" onClick={() => setBriefHidden(true)}
                    aria-label="Hide the brief and look at the room">✕ HIDE BRIEF</button>
          )}

          {/* THE BRIEFING IS THE FLAT SURFACE'S, AT DESKTOP SIZE (2026-08-02).
              PressFlat's start screen was rebuilt as a MANDATE INTAKE TERMINAL —
              a status rail, a headline, the record inside a bevelled housing with
              its closed deal-file cover, a three-cell protocol readout, and one bevelled
              gold action — and this panel was still the old briefing underneath the
              same game. Two presentations of one beat is the drift this file keeps
              logging (see the note above .ps-readcol), so the bands below mirror
              .pf-start band for band; only the metrics are desktop's.

              WHAT WAS CUT TO GET HERE, so it isn't reinstated by accident: the
              two-column prose band (.ps-open-copy's "A pitch bot is here to present
              its client's deal…" and .ps-open-aside's HOW YOUR ANALYSTS WORK) is
              replaced by .ps-protocol + .ps-directive, exactly as on the phone. The
              scarcity rule those columns spelled out is carried by ONE ANSWER EACH
              on the section line and by the 04 ANALYSTS cell. If it ever needs the
              long form back, it belongs under the section line — NOT as a third
              column, which is what forced the deal into two boxes the last time. */}

          {/* BAND 0 — THE STATUS RAIL — IS GONE (author, 2026-08-05: "there is a
              top section that says 'mandate', 'access', and 'mode' - don't need
              that"), 34px of the scroll fix.

              IT WAS THREE READOUTS AND NONE OF THEM WAS A DECISION. MANDATE was
              blank — "——" until the settle, and the settle already prints the
              ticker on the file itself, in the particulars, where a deal's name
              belongs. ACCESS GUEST and MODE LIVE SIM are true of every sitting
              this surface will ever run: nothing the player does changes either,
              and a readout that can only report one value is set dressing shaped
              like an instrument. On a briefing whose stated problem was too many
              signals ([A§20], the five-signal count), a band that reports three
              constants is the cheapest one to lose.
              The ticker survives on the record; the rest was never information. */}

          {/* BAND 1 — THE HEAD. NOTHING HERE MAY NAME THE DEAL BEFORE THE ARRIVAL
              LANDS (invariant 7): the headline is about the PLAYER'S JOB, which is
              true of every deal, so it can be the largest type on the panel without
              spoiling the one thing the panel withholds. */}
          <div className="ps-start-head">
            <div className="ps-open-eyebrow">CH 02 // INCOMING MANDATE</div>
            {/* MAKE THE CALL, never CALL THE BLUFF (author, 2026-08-03: "is
                there a bluff necessarily?"). There often isn't: every fact the
                bot states is true (§1), anon-but-real is a good deal 70% of the
                time, and §2 wants the session to read as "an offer, not a lie
                hunt" — a headline promising a bluff sends the player hunting a
                lie the game does not contain. It was also BINARY over a graded
                mechanic: the call is a conviction dial (RUG ← PASS → REAL),
                and §4 keeps the middle on purpose. THE CALL is the game's own name for the beat
                (the phase, callReadout, the 01 FINAL CALL cell below), and it
                is true of every deal — which is this headline's whole licence
                to be the largest type on a panel that withholds the deal. */}
            <h1>HEAR THE PITCH.<br /><span>MAKE THE CALL.</span></h1>
            {/* THE SUBLINE IS GONE (author, 2026-08-05: "we have 2 text
                sections - do we need 2?"). It read "One pitch. Three questions.
                Then say how much of it you believe." — and every clause of it is
                restated within 60px of itself: ONE PITCH is the headline
                directly above, THREE QUESTIONS is 03 QUESTIONS in the protocol
                row, and "how much of it you believe" is 01 FINAL CALL and the
                conviction dial it opens. The protocol row exists precisely
                because the shape of the session reads better as counts than as
                prose (see its note, which cut ~90 words on the same argument);
                this sentence was the last of that prose, saying the counts again
                in words directly above them.
                THE DIRECTIVE IS THE ONE THAT STAYS. It carries what no numeral
                can — that every fact is true TECHNICALLY, and what the player is
                actually being asked to decide. Two prose blocks on a briefing is
                one too many; the survivor should be the one that isn't a
                caption. */}
          </div>

          {/* BAND 2 — WHAT IS ABOUT TO HAPPEN, AS THREE NUMBERS.
              This replaced ~90 words in two columns (.ps-open-copy's "A pitch bot
              is here to present its client's deal…" and .ps-open-aside's HOW YOUR
              ANALYSTS WORK). Those columns existed because the panel's full width
              ran ~97ch of monospace per line and a single column of that much prose
              was unreadable — but the fix for too much prose on a briefing is less
              prose, not a second measure to put it in. The shape of the session is
              three counts; only the INCENTIVE needed a sentence, and it gets one.

              The eyebrow the copy column carried (YOUR NEXT APPOINTMENT) moved up
              to the head, where it is CH 02 // INCOMING MANDATE.

              IT MOVED ABOVE THE FILE (author, 2026-08-05: "should the description
              and number boxes be towards the top?"). The counts are orientation —
              the shape of the next four minutes — and orientation belongs before
              the object it is about, not after it. They also refer to nothing on
              screen, which is what lets them lead: 03, 04 and 01 are true of every
              sitting and name no part of this deal (invariant 7 is untouched by
              them, which is exactly why they can sit this high).

              THE DIRECTIVE DID NOT COME WITH THEM, and the reason is a forward
              reference: it opens "Every fact the PITCH BOT states is true...
              technically", and the only thing that introduces the pitch bot is the
              polaroid clipped to the file, captioned PRESENTED BY. Read above the
              file it names a character the player has not met; read below it, it
              is a remark about the face they just looked at. It also ends in the
              instruction that leads into the button, so it wants to be the last
              thing before the button. Numbers up, prose down — the split is the
              answer, not the order. */}
          {/* ONE ANSWER EACH LIVES HERE NOW (2026-08-05). It was the right half
              of the analyst band's section line, and when that band was cut for
              the scroll the rule could not go with it — it is scarcity, the
              thing that makes choosing an analyst a decision instead of a click.
              This is where it always belonged anyway: it is a property of the
              count beside it, and the section line's own note said as much about
              moving it out of the prose. */}
          <div className="ps-protocol" aria-label="Meeting protocol">
            <div><b>03</b><span>QUESTIONS</span></div>
            <div><b>04</b><span>ANALYSTS<i>ONE ANSWER EACH</i></span></div>
            <div><b>01</b><span>FINAL CALL</span></div>
          </div>

          {/* BAND 3 — THE RECORD, full panel width, inside its housing, inside
              its DEAL FILE. The record itself is unchanged: one document with
              three columns, which is what deleted the second box the particulars
              used to live in (author: "the pitch project is in 2 separate
              boxes"). See engagement.jsx — the folder cover, tab and routing
              block all live there so both surfaces get one file.

              THE HOUSING IS NOT DECORATION: the bevelled shell is what makes the
              file read as something that ARRIVED on a terminal rather than a
              form the page drew. Its readout is gone — the cover's letterhead
              names the document instead, PROSPECTUS (author's word), and the
              status lives in exactly one place, the record's own pill.

              THE CAPTION IS STILL GONE (author: "this line seems unnecessary"). It
              read SENT DOWN TO YOU · YOU DON'T GET TO ASK WHY THIS ONE, and it was
              load-bearing exactly once — against the dice, where naming who chose
              was the one thing a randomiser could not do for itself. A form that
              arrives already signed never raises the question. [A§20]. */}
          {/* THE SEALED OVERLAY IS GONE (2026-08-03), same change as the flat
              surface and for the same reasons: its CLIENT // SEALED narration,
              02 glyph and scan bars had crept back to the five-signal count
              [A§20] records this briefing dying of, and its 1px/visibility
              collapse hacks hid the blank form the record is supposed to BE.
              The deal file's cover (see engagement.jsx) withholds the record by
              geometry instead; the readout's DEAL INTAKE label was retired for
              the cover's PROSPECTUS letterhead, and the record's own pill is
              the one place this panel says "not yet". */}
          {/* THE INTAKE ROW — the file, and the one person in the building who
              is yours (author, 2026-08-05: "maybe i should feature him on the
              engagement screen?" / "all that manila envelope is dominating the
              space"). Those are one problem: the folder read as dominant partly
              because it was 58% of a panel where nothing else earned any room.
              Putting Virgil beside it fixes both — the folder narrows to ~450 in
              its own column, and the space it gives up goes to something rather
              than to margin.

              WHY THIS PLACEMENT IS SAFE WHEN THE OLD ONE WASN'T. A cat's face on
              this panel failed once: above the pitching CTA it read as the CAT
              doing the pitching (author, 2026-07-28). What made it safe again in
              the analyst band was that the pitcher stopped being one of these
              faces — and here that argument is at its strongest, because the
              pitcher's face is 16px away on the folder itself, captioned
              PRESENTED BY. Two portraits, one labelled as the presenter and one
              labelled YOUR GUIDE, cannot swap. He does NOT go back over the
              button.

              HE IS THE ONLY ONE WHO BELONGS HERE. The four analysts were cut
              from this panel earlier today because they are consultants you
              meet when you can spend them; Virgil is not spendable and not
              staff — virgil.js: "he is on your side, which not one other person
              at this desk is." A briefing is exactly when that is worth knowing.

              EVERY STRING IS VIRGIL'S OWN DATA — name, role line and blurb
              straight off the export, no new copy for this surface to keep in
              sync. The blurb does the work the analyst band's NOT A SEAT
              divider used to: "Cannot be sent anywhere." */}
          <div className="ps-intake">
          <div className="ps-record-shell">
            <EngagementRecord
              arrived={identity}
              title={identity ? "Deal Brief" : "Inbound Deal"}
              restStatus="AWAITING REVIEW"
              arrivedStatus="MEETING SET"
              stampLabel="Meeting Set"
              fileNo={fileNo}
              client={identity ? deal.name : null}
              surface={identity ? deal.surface : null}
              ticker={identity ? deal.ticker : null}
              chain={identity ? deal.chain : null}
              sector={identity ? deal.sector : null}
              ref={recordRef} clientRef={clientRef}
              particularsRef={particularsRef}
              stampRetainedRef={stampRetainedRef}
              coverRef={coverRef} />
          </div>

            {/* NOT A BUTTON AND NOT A SEAT — no onClick, no hover lift, nothing
                that invites a press. That is the failure this character was
                invented to make impossible (see virgil.js: a colleague with an
                exemption needs explaining, and the fix was a creature nobody
                tries to dispatch). The moment this card gains an affordance it
                becomes a fifth seat. */}
            <aside className="ps-guide">
              <img className="ps-guide-pic" src={VIRGIL.portrait} alt="" aria-hidden="true" />
              <div className="ps-guide-who">{VIRGIL.name}</div>
              <div className="ps-guide-role">{VIRGIL.role}</div>
              <p className="ps-guide-blurb">{VIRGIL.blurb}</p>

              {/* WHAT THE 04 ANALYSTS CELL DOESN'T SAY (author, 2026-08-05:
                  "maybe since i have a lot of space in virgil's box, i could
                  rotate through the analyst's pictures?"). The space is real and
                  so is the gap — the protocol row asserts four analysts and one
                  answer each, and nothing on the panel says four analysts OF
                  WHAT. This is that answer.

                  SUBJECTS, NOT FACES, AND THAT IS THE WHOLE POINT. Portraits
                  cycling in this frame would put Virgil first in a carousel of
                  five and collapse the one distinction he exists to create —
                  virgil.js: he is on your side, "which not one other person at
                  this desk is", and the band this replaced kept a divider and a
                  NOT A SEAT line precisely to hold that apart. A rotation is
                  also a worse roster than the one that was cut: four at once let
                  a player compare them, one at a time does not, and anyone who
                  presses REVIEW early meets two.
                  What was mechanically load-bearing about that band was never
                  the faces anyway — it was the LANES. You meet the people when
                  you can spend them; you need to know the coverage now.

                  IT IS IN HIS CARD BECAUSE HE IS THE ONE WHO WOULD TELL YOU.
                  Listing your resources is what a guide does, and it keeps the
                  structural line intact: he is the speaker, they are the list. */}
              {/* NAMED, BECAUSE "THEY" HAD NO ANTECEDENT (author, 2026-08-05:
                  "there's no context about who 'they' are"). The first build of
                  this list was four bare subjects under WHAT THEY COVER, and the
                  only thing on the panel that "they" could point at was the
                  numeral 04 in a different band. A coverage list with nobody
                  attached is a table of contents for a book you can't see.
                  YOUR ANALYSTS, keeping the possessive the deleted band's label
                  had — its note called that half load-bearing: they are the
                  player's, one use each. The count and the scarcity are in the
                  protocol row directly above; this says who they are and what
                  each one is for, which is everything that band taught except
                  the faces. */}
              <div className="ps-guide-lanes">
                <span>YOUR ANALYSTS</span>
                <ul>
                  {DESK_ORDER.map((m) => (
                    <li key={m.id}><b>{m.name}</b>{m.role}</li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          {/* THE TWO THINGS THE NUMBERS CAN'T SAY: what kind of claim is coming,
              and who pays the speaker — in that order, rewritten 2026-08-03
              (author: "let's just rewrite the whole section"). See the long note
              at the same paragraph in PressFlat for why the facts-are-true line
              now leads and why SEND had to go ([A§11], [A§20]); the two surfaces
              carry identical copy and must be edited together.

              WHAT THIS REPLACED, so it isn't reinstated: "Connor brought this one
              in — it's his deal" until 2026-07-29, which stopped being true when
              the bot took over the selling; then "an agent is here for a client
              who didn't come", cut the same day for pointing at the absence
              instead of the incentive. */}
          <p className="ps-directive">
            Every fact the pitch bot states is true...technically. But is the project viable? Consult with the team and decide whether to fund it or FUD it.
          </p>

          {/* BAND 4 — THE DESK — IS GONE (author, 2026-08-05: "what i'd like to
              do is avoid scrolling to see everything").

              THE BRIEFING WAS 890px OF CONTENT IN A 699px SLOT on a 779px window
              — worse on a 13" laptop — and this band was 119 of the 191 over,
              149 with the section line that existed only to label it. It was the
              one cut that fixes the scroll rather than nibbling at it, and the
              only band on the panel whose job another screen already does.

              IT WAS AN INTRODUCTION TO PEOPLE YOU MEET ONE CLICK LATER. Its own
              note said so — "on the briefing they are an introduction, and the
              sendable version of the same four is the seat row on the floor" —
              which is an admission that the band is a preview of the next
              screen. Meeting an analyst at the moment you can spend one is a
              better introduction than meeting a portrait of them while you can't.
              The COUNT was the part that was a rule, and the count is still on
              the panel: 04 ANALYSTS, in the protocol row, now carrying ONE
              ANSWER EACH with it.

              VIRGIL WENT WITH IT, AND HE IS FINE. His card was his only
              appearance on the briefing, but the floor's first beat IS him — he
              opens it in his own player with the house rules, speaking, which is
              what he is for. A silent portrait one screen earlier was the weaker
              of his two introductions. If he ever needs to be on the briefing
              again he does NOT go back above the CTA: a cat's face over the
              pitching button read as the cat doing the pitching (author,
              2026-07-28), and the divider and NOT A SEAT line existed to hold
              that reading off.

              WHAT THIS COSTS, so it is a decision and not an accident: nothing
              on the briefing now shows the player who is on their side. The bet
              is that one click away, said out loud, lands harder. */}

          {/* The one live control. My seat-row rewrite replaced the whole
             tools block and took this with it, which left the briefing with
             nothing to press — "there is no deal specified or buttons to
             push" (author, 2026-07-27). */}
          {/* ONE BUTTON. A LOCAL/DAILY split lived here for part of a day and
              was cut: the daily's justifications all belonged to a
              leaderboard that got rejected, and the one that survived — a
              shared deal to talk about — is latent until a share hook exists,
              which is a bet on traction rather than a feature. A choice that
              gives the player nothing teaches them choices here don't
              matter. See the note in instanceDeal.js. */}
          <div className="ps-cta-row">
            <button className="ps-lock"
                    onClick={rolled
                      ? () => {
                        // The ONLY user gesture we are guaranteed before audio
                        // has to play. iOS will not play a decoded buffer
                        // without one; fails soft, so no audio still leaves a
                        // playable game.
                        try { unlockAdviserAudio(); } catch {}
                        setStarted(true);
                      }
                      : runRoll}
                    disabled={rolling}>
              {/* "ROLL THE DEAL" / "ROLLING…" until 2026-07-29 — stale from the
                  dice cut, then "DECODING…" until the cipher went, then SEND IT IN
                  until the author read it back: "seems like strange wording to me".
                  It is — "send it in" is receptionist-speak for a person you can
                  point at, and the "it" here names nothing the player has met.
                  [A§11] rejected "send" for the ANALYSTS on the neighbouring ground
                  that they never leave their desks; the verb failed on both sides
                  of the table.

                  TAKE THE MEETING / SIGNING… until 2026-08-02, when the panel took
                  the flat surface's intake framing. The verbs have to agree with
                  the screen around them: nothing on the panel is an APPOINTMENT any
                  more — it is an inbound FILE, sealed, awaiting review — so REVIEW
                  THIS DEAL is the action the rest of the bands describe, and
                  OPENING… is what happens to a sealed file. Kept identical to
                  PressFlat's on purpose; one beat, one set of words. */}
              {rolled ? "HEAR THE PITCH ▸" : rolling ? "OPENING…" : "REVIEW THIS DEAL ▸"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- THE LEFT STACK: VIRGIL'S FEED, THEN THE READING COLUMN ----------

          ONE ELEMENT FOR THE WHOLE SITTING, and that is the point of the
          restructure. What used to be here was three separate conditional blocks
          — the cat's tile pinned top-left, an opening column, and a floor column
          — which is why the tile could not live anywhere near the words it
          belongs to. Now the stack is bottom-anchored, the tile is its head and
          the column is its body, so the two move together and nothing has to
          guess where the other one ended up.

          ---- VIRGIL, AS A 2D PLAYER OVER THE ROOM ----

          THE GLB CAT CANNOT DO THIS, and that is the whole reason this panel
          exists on a surface that already has him in the room. The temple's
          SitePal work is a PROJECTION: a rendered head cropped onto a character's
          face MESH (SITEPAL_PROJECTION_CONFIG's `crop`/`filter`, the Demon's Face
          and the Monk's). fluffyCat.glb has no face mesh to project onto — a cat
          muzzle is not a human face plate — so there is nothing to paint his
          lip-sync onto. The 3D cat can idle, blink and relocate between rounds,
          and that is all he will ever do.

          SO THE CAMERA STAYS ON THE PITCHER while he talks (his part of the claim
          turn no longer names an agent) and his voice comes from this tile
          instead. Cutting to the glb AND running this panel would put two Virgils
          on screen, one of them mute and filling frame — worse than either alone.

          IT NO LONGER COMES AND GOES. It was mounted for the whole floor and
          faded in only for his ~3s line, in the top-left corner, a long way from
          his words: "pops up in the far top left corner, speaks a very short
          phrase, and then disappears" (author, 2026-08-04). A face you see for
          three seconds an entire screen away from its transcript reads as a
          glitch, not as a character. It is a standing feed now — his desk is
          simply always on — and only the ON AIR state changes when he talks.

          MOUNTED ON `onFloor`, NOT `floorLive`, which is a second thing the gate
          bought us: the player takes seconds to boot, and mounting it at the top
          of the opening remarks means it has the whole introduction to come up
          before anyone looks at it.

          IT IS OUTSIDE .ps-readcol, WHICH IS THE ONE PLACE IT MUST NOT GO. The
          obvious home is next to his transcript, in place of the 34px portrait
          in ClaimBody — but that block sits inside the column's SCROLLER, and a
          SitePal subframe scrolled out of an overflow container has an empty clip
          rect and gets throttled by WebKit to ~0.1fps. The symptom is the exact
          bug this tile was built to cure: he speaks with a frozen face, silently,
          audio untouched. [[sitepal-iframe-offscreen-throttle]] has already been
          re-learned twice, once through precisely this — "an overflow-clipped
          second portal". Docked above the scroller it is adjacent to his words
          and permanently on screen, which is what that idea actually wanted.

          pointer-events stay off: he is not a seat, cannot be sent anywhere, and
          a clickable cat is an invitation to try. */}
      {/* MOUNTED BEFORE THE FLOOR, SO HIS PLAYER HAS TIME TO BOOT (author,
          2026-08-05: "considerable lag to start virgil… voice starts after 20 or
          more seconds but without any sitepal animation").

          This block was gated on `onFloor`, and `onFloor` flips on the very
          click that starts the briefing — so the SitePal iframe BEGAN LOADING at
          the instant Virgil's first line was handed to it. It could not have
          been ready; a scene takes seconds. Everything downstream was
          consequence, including the watchdog stall virgilPortalLive now
          documents.

          The briefing screen is dead time the player spends reading and
          clicking, which is exactly the warm-up the portal needed and never got.
          Rendering the stack from mount hands it those seconds.

          HIDDEN BY OPACITY, NOT UNMOUNTED AND NOT MOVED OFF-SCREEN. Unmounting
          is what caused this. Off-screen is worse than either: WebKit throttles
          off-screen subframes to ~0.1fps, which is how you get a portal that
          speaks with a frozen face. Opacity is the technique SitePalPortalTile
          already uses for its own `active` prop, for the same reason. */}
      {(
        /* `ghost` while a screen is in focus — see screenLook. Ghosted rather
           than removed, and it keeps its pointer events, so hovering it brings
           it straight back: the player can re-read the claim against the
           receipt without any new control, and nothing they were mid-sentence
           on disappears on them. */
        /* `inert` WHILE WARMING. The block is invisible but it still contains
           SKIP THE RULES and the gate button, and opacity alone leaves both in
           the tab order and reachable by a screen reader — a keyboard could
           start the pitch from a panel nobody can see. inert drops the subtree
           from hit-testing and focus without touching layout, which is what the
           iframe underneath needs kept intact. */
        <div className={`ps-readstack${screenLook ? " ghost" : ""}${onFloor ? "" : " warming"}`}
             inert={!onFloor || undefined}
             aria-hidden={!onFloor || undefined}>
          {/* ONE COLUMN, TWO CONTENTS. The opening and the floor were two
              sibling .ps-readcol blocks that happened to be styled alike; making
              them one element is what stops the block moving when claim 1
              replaces the remarks, which the old comment here only claimed. */}
          <div className="ps-readcol">
            {!briefed ? (
              /* THE CAT FIRST. Not quoted — he is talking to you, where the bot
                 is being quoted at you. */
              <div className="ps-fade in">
                <OpeningBody lines={briefLines} at={briefAt} onSkip={skipBrief}
                             done={briefDone}
                             onBegin={briefDone ? beginBrief : null}
                             who={VIRGIL.name} kicker="— the house rules"
                             skipLabel="SKIP THE RULES ▸"
                             beginLabel="◉ READY — LET THE PITCH BEGIN ▸"
                             cue="▼ PRESS THIS TO START THE PITCH"
                             quoted={false} subtitle />
              </div>
            ) : !opened ? (
              <div className="ps-fade in">
                <OpeningBody lines={openingLines} at={openingAt} onSkip={skipOpening}
                             done={openingDone}
                             onBegin={openingDone ? beginPitch : null} />
              </div>
            ) : claim ? (
              <>
                {/* Claim and answer share ONE flow column, so a long answer
                    pushes the claim up instead of covering it. Both bodies come
                    from pressUi — this file owns only WHERE the column sits. */}
                <div className={`ps-fade ${claimVisible ? "in" : ""}`}>
                  <ClaimBody claim={claim} virgil={virgil}
                             pressure={mood} aside={aside}
                             spent={run.advisersSpent}
                             /* HIS READ IS NOT PART OF THE CLAIM ON THIS SURFACE.
                                It is rendered below with his feed — see the
                                .ps-virgil block. Leaving it here put his sentence
                                inside the argument it is about, with his face a
                                column away from it. PressFlat keeps it inline. */
                             showVirgil={!VIRGIL.sitepal} />
                </div>
                {flash && flash.id === claim.id && (
                  <AnswerBody flash={flash}>
                    <AnswerChoice flash={flash} onLook={lookAtBoard} onHear={hearReply} />
                  </AnswerBody>
                )}

                {/* ON THE RECORD. Claim six is a decision about claims one to
                    five, and until now the only way to hold them was to remember
                    them — the controller has been recording every one in
                    `run.chips` since the first slice and neither surface ever
                    showed it. Collapsible, and it scrolls inside itself so it
                    can't push the claim body around. */}
                <Transcript run={run} deal={deal} open={script}
                            onToggle={() => setScript((v) => !v)} />
              </>
            ) : null}
          </div>

          {/* ---------- VIRGIL: ONE BLOCK, FACE AND WORDS ----------

              THE COLUMN READ VIRGIL / PITCH BOT / VIRGIL. The feed went in at the
              top of the stack and his read stayed inside ClaimBody, so the cat
              appeared twice with the argument he is commenting on wedged between
              the two halves of him (author, 2026-08-04). Pinned UNDER the column
              they are one panel: you read the claim, then the only person in the
              room on your side tells you what shape it is.

              WHY NOT SLID OUT OF THE SEAT ROW, which was the other idea on the
              table: a slide-out is a thing that comes and goes, and coming and
              going is the behaviour we just removed. Worse, it cannot work at
              all — hiding a SitePal subframe (translated away, collapsed, behind
              a closed drawer) empties its clip rect and WebKit throttles it to
              ~0.1fps, so he would slide out mid-line with a frozen face. He also
              is not a seat: the row is five people you can SPEND, and putting the
              one free voice in it invites a click that has to be refused.

              BELOW THE SCROLLER, NOT IN IT, for the same clip-rect reason — see
              [[sitepal-iframe-offscreen-throttle]]. The column shrinks and
              scrolls above him; this block never moves.

              THE FEED IS RENDERED HERE, NOT PASSED INTO VirgilRead, so it holds
              one position in the tree across the whole sitting. It mounts with
              the opening remarks (SitePal takes seconds to boot) and must not be
              re-parented when the first claim arrives — a remount reboots the
              player, which is the several-second stall this placement exists to
              hide. */}
          {VIRGIL.sitepal && (
            /* HE IS THE BEAT WHILE HE IS BRIEFING YOU, and a thumbnail while he
                is working. `lead` is on until the pitch takes the floor.

                The tile was 104px square for the whole sitting, which is right
                for a cat commenting on somebody else's claim and wrong for the
                one stretch where he IS the screen. He guides by VOICE, and a
                voice coming out of a 104px thumbnail beside a wall of text does
                not read as being guided by anyone (author, 2026-08-04: "virgil
                has the talking screen. Let's tighten the view/enlarge him so we
                can see him better"). Large and centred while he talks you in;
                back to a working tile the moment claim 1 lands and the column
                needs its width for his read.

                THE ELEMENT DOES NOT MOVE IN THE TREE — see the note above. Only
                its class changes, so the player is never re-parented and never
                reboots. */
            <div className={`ps-virgil${speakingVirgil ? " on" : ""}${opened ? "" : " lead"}`}>
              <span className="ps-virgil-feed">
                {/* No `active` — it defaults true and the tile is meant to be
                    seen for the whole sitting. Passing speakingVirgil here is
                    what dropped the wrap to opacity 0.01 between lines, i.e. the
                    disappearing act itself. */}
                <SitePalPortalTile
                  id={VIRGIL_PORTAL_ID}
                  sitepal={VIRGIL.sitepal}
                  still={VIRGIL.portrait}
                  /* TIGHTER WHILE HE LEADS. `zoom` rides on the measured fit, so
                     this is a crop toward the face rather than a raw scale — the
                     tile's own note records what treating it as a raw scale did. */
                  zoom={opened ? 1 : 1.18}
                  originY={opened ? "50%" : "44%"}
                  /* THE SCENE COMES UP LOOKING UPWARDS. Centre him the moment
                     the player reports in, so the first thing you see is a cat
                     facing you rather than one studying the ceiling while it
                     waits for its first line. speakVirgilLine repeats this
                     before every line — see faceVirgilFront for why once is
                     not enough. */
                  onReady={(ok) => { if (ok) faceVirgilFront(); }}
                />
              </span>
              {opened && claim ? (
                <VirgilRead claim={claim} virgil={virgil} spent={run.advisersSpent} reveal={virgilAt}
                            remaining={outlook.remaining} earlier={outlook.earlier}
                            onToggleTips={() => setTips((t) => !t)}
                            portrait={false}
                            status={speakingVirgil ? "ON AIR" : "LIVE"}
                            statusOn={speakingVirgil} />
              ) : (
                /* He has nothing to read yet — the bot has made no claim. Naming
                   him is still worth the two lines: the feed is on from the
                   opening remarks, and an unlabelled cat watching you is a
                   question rather than an ally. */
                <span className="ps-virgil-wait">
                  <b>{VIRGIL.name.toUpperCase()}</b>
                  <i>the office cat · he reads every claim.</i>
                  {/* THE RULES AGAIN, while the opening column is still his to
                      print in. It disappears the moment claim 1 lands — see the
                      note on VirgilRead's onReplayBrief. */}
                  {briefed && !opened && (
                    <button type="button" className="ps-virgil-rules" onClick={replayBrief}>
                      run the rules again
                    </button>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- the floor's controls ---------- */}
      {floorLive && claim && (
        <>
          {/* The controls, grouped bottom-right and clear of the reading
              column on the left. */}
          <div className="ps-dock">
            <SeatRow run={run} live={live} pressed={pressed} options={options}
                     onPress={press} />
            <Nav lastClaim={lastClaim} pressed={pressed} onAdvance={advance} onCallIt={callIt} />
          </div>

          <div className="ps-progress">
            {deal.claims.map((c, i) => (
              <span
                key={c.id}
                className={`ps-dot ${i < run.claimIndex ? "past" : ""} ${i === run.claimIndex ? "now" : ""} ${run.outcomes[c.id] ? (run.outcomes[c.id].receipt ? "hit" : "black") : ""}`}
              />
            ))}
          </div>
        </>
      )}

      {/* ---------- the call ---------- */}
      {run.phase === PHASE.ALLOCATION && (
        <div className="ps-panel">
          <div className="ps-panel-h">YOUR CALL — {deal.ticker}</div>
          {/* ONE GAUGE, BOTH SURFACES (2026-08-05). This was a bare styled
              range input duplicated here and in PressFlat, with these two long
              label notes copied alongside it — the exact shape that let the two
              floors drift apart the first time. The control and its face now
              live in pressUi.ConvictionGauge; the reasoning about the LABELS
              stays here because it is about this game's vocabulary, not about
              the widget. */}
          {/* THE ENDS NAME WHAT THE SLIDER MEASURES (2026-08-03). They read
              SHORT · FLAT · LONG, which promised a position with a SIZE — and
              the control has never taken one: sliderToP maps the handle to
              P(this is a rug) and the stake is fixed, so what you are setting
              is CONVICTION. The labels also disagreed with the sentence
              directly beneath them, which has always spoken in rug/real/
              passing (callReadout). Left is p=1 and right is p=0, so RUG sits
              left; PASS is the word the readout itself uses at dead centre. */}
          {/* FUND vs FUD (author, 2026-08-03) — one letter apart, and both are
              things a desk DOES, which is what SHORT/LONG and REAL/RUG could
              not manage: funding is one-sided, so "reject it" could only ever
              label half a two-sided control. FUD names the left half as an
              action without alleging fraud, which matters because the downside
              is not always a theft — it may be illiquid, or played out. Left
              is p=1, so FUD sits left; PASS is the readout's own word for dead
              centre. NOTE: VerdictScreen.jsx runs the mirrored order (TRUST
              left); settle the direction before the two games merge. */}
          <ConvictionGauge value={slider} onChange={setSlider} />
          <div className="ps-saying">{readout.saying}</div>
          <div className="ps-risk">{readout.risk}</div>
          {/* WHERE THE SIZE WENT (author, 2026-08-05: "i do see the different
              win/loss values, but… i don't know how i got to those values. I
              don't know the questions i asked had some opportunity cost"). The
              two numbers above are the whole point of the screen and they arrive
              unexplained; the floor's meter prices the NEXT specialist and never
              accounts for the ones already bought. See stakeNote. */}
          <div className="ps-stakenote">{stakeNote(run)}</div>
          <button className="ps-lock" onClick={lockCall}>LOCK IT IN</button>
        </div>
      )}

      {/* ---------- resolution ----------
          A LOWER THIRD, not a centred panel. The four of them stand up and play
          their real reactions during this beat — putting a box over the middle
          of the frame hides the entire payoff (and repeats the sin of the CRT
          overlay this whole mode exists to get rid of). Keep the upper two
          thirds clear; the copy is short enough to read in a strip. */}
      {run.phase === PHASE.RESOLUTION && (
        <div className="ps-lower">
          {/* FOUR BANDS, NOT A SIGN TEST — see callVerdict in pressRun.js, and
              keep this identical to PressFlat's: one run, two presentations, and
              the two surfaces must never name the same call differently. */}
          <div className={`ps-lower-pnl ${verdict ? verdict.tone : "up"}`}>
            {run.call.pnl > 0 ? "+" : ""}{Math.round(run.call.pnl)}
          </div>
          <div className="ps-lower-body">
            <div className="ps-lower-h">{verdict ? verdict.label : ""}</div>
            {/* The bet, restated against the outcome, before the deal's story. */}
            {betRestated(run, deal) && (
              <div className="ps-lower-bet">{betRestated(run, deal)}</div>
            )}
            <div className="ps-lower-truth">{deal.resolution}</div>
            {/* THE GAP, SAID OUT LOUD (§7 item 7) — see the note on PressFlat.
                Renders only when the claims held and it folded anyway. */}
            {settlementNote(run, deal) && (
              <div className="ps-lower-note">{settlementNote(run, deal)}</div>
            )}
          </div>
          <button className="ps-lower-go" onClick={finish}>WHAT WAS ACTUALLY SAID ▸</button>
        </div>
      )}

      {/* ---------- autopsy ----------
          Anchored RIGHT rather than centred: the four are still standing on the
          platform through this, and the left half of the frame is where they
          are. Long content, so it scrolls in its own column. */}
      {run.phase === PHASE.AUTOPSY && (
        /* HEADER AND EXIT ARE PINNED; ONLY THE MIDDLE SCROLLS. The whole panel
           used to be one scrolling box with LEAVE THE DESK as the last child,
           which put the only way out ~1150px down a 530px-tall panel with
           nothing on screen saying so — "no action or exit buttons" (author,
           2026-07-27). A terminal state must never hide its exit below a fold. */
        <div className="ps-panel side autopsy">
          {/* "POST-DEAL ANALYSIS", not THE AUTOPSY (author, 2026-07-28).
              Invariant 6 again, and the same failure as "the tape": a term
              chosen for flavour that the player has to translate. "Autopsy"
              also presumes a corpse — but roughly a third of these deals are
              LEGIT, and calling the debrief on a good call an autopsy tells the
              player they lost before they've read a number.

              "Post-mortem" was the other candidate and is the same problem in
              Latin. The internal names stay — PHASE.AUTOPSY, deal.autopsy,
              toAutopsy() — because renaming authored content keys and the
              controller would be churn for no player-visible gain. */}
          <div className="ps-panel-h">POST-DEAL ANALYSIS</div>
          <div className="ps-au-body">
            <div className="ps-scores">
              <div><span className="ps-dim">READ</span><b>{read.hit}/{read.spent || 0}</b></div>
              <div><span className="ps-dim">BOOK</span><b>{Math.round(run.book)}</b></div>
            </div>
            <div className="ps-readnote">{read.note}</div>

            {/* THE PATTERN. The single most portable thing the player leaves
                with — not "MERIDIAN rugged" but "this is what a backdoor-fork
                looks like". The exemplar coin is the collectible worth earning,
                because it's the archetype, not one token's answer. */}
            {/* THE PATTERN — four things wrong with this block, all reported
                2026-07-28, all from one cause: it led with a DIFFERENT TOKEN'S
                name and never said what the relationship was.

                  "YOU'VE SEEN THIS SHAPE BEFORE" — *"the player may not have
                    'seen this shape before'"* (author). Flatly false on a first
                    play, and it was the headline.
                  "BlackPalm" — the deal was ALDERMAN. The exemplar's name was
                    the largest text on a screen summarising a different token.
                  "PALM · backdoor-fork" — a kebab-case code slug in the UI.
                  "Drained day 40" — BlackPalm's collapse day, sitting directly
                    under this deal's result, which collapsed on a different one.

                Now it goes: name the pattern, tie THIS deal to it, then offer
                the classic case as an explicitly separate, earlier example. */}
            <div className="ps-pattern">
              <div className="ps-pattern-copy">
                <div className="ps-pattern-label">THE PATTERN</div>
                <div className="ps-pattern-name">{deal.archetypeLabel}</div>
                <div className="ps-pattern-was">
                  {deal.name} was one of these.
                </div>

                {/* THE TELL, NOT A SECOND TOKEN. This block used to print the
                    exemplar coin — "BlackPalm / $PALM" plus its card art and
                    its own collapse day. Two objections killed it, both right:
                    *"as a player, it makes me want to see more about
                    'Black Palm'"* and *"why reference a different project?"*
                    (author, 2026-07-28).

                    There is no more to see — BlackPalm is a Genesis card, and
                    cards left this game for the 2D TCG, so the name pointed at
                    a product that doesn't exist yet. And the player does not
                    need a stranger's example: they just spent four minutes with
                    a concrete case of their own, which they care about far more.

                    What their own deal CAN'T give them is the rule that
                    survives the token. That's this. */}
                {deal.archetypeTell && (
                  <div className="ps-pattern-case">
                    <div className="ps-pattern-caselabel">THE TELL</div>
                    <div className="ps-pattern-note">{deal.archetypeTell}</div>
                  </div>
                )}

                <div className="ps-pattern-foot">
                  Same shape, different token. Learn it and you get every one of these.
                </div>
              </div>
            </div>
            {deal.claims.map((c) => (
              <div key={c.id} className={`ps-au ${run.outcomes[c.id] ? "pressed" : ""}`}>
                <div className="ps-au-fact">{c.fact}</div>
                <div className="ps-au-verdict">{deal.autopsy[c.id]}</div>
                {run.outcomes[c.id] && <div className="ps-au-you">— you pressed him on this</div>}
              </div>
            ))}
          </div>
          <button className="ps-lock" onClick={onExit}>BACK TO THE DESK</button>
        </div>
      )}
    </div>
  );
}

const CSS = ENGAGEMENT_CSS + PRESS_UI_CSS + `
/* FIXED, not absolute: this portals into document.body, which on /trade is
   taller than the viewport — an absolute inset:0 stretched the layer down the
   whole page and pushed the dock off-screen. */
.ps-root { position:fixed; inset:0; z-index:10050; pointer-events:none;
  font-family:'Courier New', monospace; color:#eafff9; }
.ps-root button, .ps-root input { pointer-events:auto; font-family:inherit; }

/* ANYTHING THAT SCROLLS MUST TAKE THE POINTER, OR THE ROOM EATS THE WHEEL.
   .ps-root is pointer-events:none so the live scene stays draggable around the
   UI, and only buttons and inputs opted back in. A scroll CONTAINER never did —
   so a wheel over the autopsy passed straight through to the R3F canvas, which
   orbited the camera while the panel sat still: "I am unable to scroll further
   down the summary as the canvas is capturing my mouse to orbit around the
   scene" (author, 2026-07-28). The summary was unreadable past the fold.

   This is a property of every overflow container in this file, not just the one
   that was reported — the autopsy is simply the only panel long enough for
   anyone to hit it. Listed explicitly rather than blanket-enabling .ps-root,
   because the whole point of the none/auto split is that the room stays
   reachable between the panels. */
.ps-readcol, .ps-open, .ps-panel.scroll, .ps-au-body { pointer-events:auto; }
.ps-dim { color:rgba(234,255,249,0.5); }

.ps-bar { position:absolute; top:0; left:0; right:0; height:44px; display:flex;
  align-items:center; justify-content:space-between; gap:12px; padding:0 14px;
  background:linear-gradient(180deg, rgba(2,16,14,0.9), rgba(2,16,14,0));
  font-size:12px; letter-spacing:0.08em; }
/* EASY TO MISS (author, 2026-08-05: "there's a 'leave the desk' button in the
   top left but it is easy to miss"). 11px hairline cyan on a dark room, in the
   corner, at the same weight as the two readouts beside it — it was styled like
   a label and read like one. It is the only way out of the game, so it gets
   filled, bordered at full strength, and lifts under the pointer. Still cyan and
   still small: it must not compete with the gold CTA that moves the game ON. */
.ps-exit { background:rgba(4,20,15,0.9); border:1.5px solid rgba(47,214,214,0.8);
  color:#2fd6d6; font-size:11px; font-weight:bold; letter-spacing:0.1em;
  padding:7px 12px; border-radius:3px; cursor:pointer;
  box-shadow:0 0 12px rgba(47,214,214,0.18);
  transition:background .15s ease, box-shadow .15s ease; }
.ps-exit:hover { background:rgba(47,214,214,0.18);
  box-shadow:0 0 18px rgba(47,214,214,0.35); }
/* ARMED — see exitArmed. It leaves the cyan family entirely rather than just
   getting brighter: this is the one control on the surface that destroys work,
   and a player who is not reading the label has to be able to tell from colour
   alone that the button under their cursor is no longer the one they clicked.
   The pulse is what carries the four-second window without printing a timer. */
.ps-exit.armed { border-color:#ff9b6f; color:#ff9b6f;
  background:rgba(40,10,4,0.92); box-shadow:0 0 16px rgba(255,155,111,0.4);
  animation:psarm 1s ease-in-out infinite; }
.ps-exit.armed:hover { background:rgba(255,155,111,0.22);
  box-shadow:0 0 22px rgba(255,155,111,0.55); }
@keyframes psarm { 0%,100%{opacity:1} 50%{opacity:.72} }
.ps-deal { font-weight:bold; letter-spacing:0.1em; }

/* THE THREE STANDING NUMBERS, SIZED TO BE READ (author, 2026-08-05: "make the
   Book and 'questions left' and 'stake' amount bigger").
   BOOK and STAKE are the two quantities the whole game settles in, and QUESTIONS
   LEFT is the budget every press spends — they had all been sized as bar
   furniture, at 10 to 15px, next to a ticker in the same weight.
   THE METER RULES ARE SCOPED TO .ps-bar ON PURPOSE. .pu-meter is shared with the
   flat surface, where it sits beside the claim in a phone-width column rather
   than alone in a 44px bar; growing it there would cost the claim its room.
   Same markup, two contexts, and only this one has the space. */
.ps-book { font-size:13px; }
.ps-book b { color:#ffd23a; font-size:20px; margin-left:7px; }
.ps-bar .pu-meter { gap:6px; }
.ps-bar .pu-meter > span { width:12px; height:12px; }
.ps-bar .pu-meter em { font-size:12px; margin-left:7px; }
.ps-bar .pu-meter .pu-price { font-size:12px; margin-left:9px; }
.ps-bar .pu-meter .pu-price b { font-size:16px; margin-left:4px; }

/* THE FLOOR MARKUP LIVES IN pressUi.jsx AND IS STYLED THERE.
   What stays here is only what is TRUE OF THIS SURFACE: where the two blocks
   sit, and the fact that they float over a live 3D room and so need their own
   background. The claim/answer/seat/meter/nav rules that used to be duplicated
   below are gone — keeping a second copy is what let the two presentations
   drift apart in the first place. */

/* ONE PANEL, BOTTOM RIGHT. The dock used to span the full width, which put the
   seat cards on top of the claim text on the left, the pip meter adrift in the
   middle of the room and the nav stranded far right — "corner UI is a bit
   messy" (author, 2026-07-27). The claim owns the left, the controls own the
   right, and they never touch. */
/* CLEAR OF THE SITE'S BOTTOM NAV. .btm-nav-dock is 66px tall, fixed, at
   z-index 10000 — and .ps-root is 10050, so the floor DRAWS OVER the nav instead
   of being clipped by it. At bottom:46px the reading column, the controls and the
   progress rail were all inside that band, sitting on top of BUY RL80 / HOME.
   It read as harmless while the transcript was transparent text; an opaque panel
   over the nav does not. One inset so the three blocks stay in step, and the
   column's TOP edge is unchanged — it starts where it always did and gives the
   38px back at the bottom, where it was never ours. */
.ps-root { --nav-clear:72px; }
/* THE STACK OWNS THE CORNER; the column just lives in it.
   The positioning that used to be on .ps-readcol moved up one level so the cat's
   feed can be docked to the column's top edge and stay there as the transcript
   grows. Bottom-anchored, as it always was — the column still fills upward. */
/* GHOSTED WHILE A SCREEN IS IN FOCUS. Opacity rather than display:none for two
   reasons: the column can come back on hover with no new control, and a block
   that vanishes outright takes the player's place in the text with it.
   0.06 and not 0 — a faint trace is what makes the hover discoverable. */
/* The page's own headline, reached by attribute because it is not in this
   component's tree — see the data-press-screenlook effect. Goes fully out and
   does not come back on hover: it is decoration, not something to re-read. */
/* !important IS LOAD-BEARING HERE, and it is the one thing that made the first
   attempt do nothing (author, 2026-08-05: "h1 didn't hide"). .custom-title sets
   its opacity INLINE — app/trade/page.js computes "focusedAgent || talkShowMode
   ? 0 : 1" in a style object — so a stylesheet rule at any specificity loses to
   it. The same page already reaches for the same escape hatch on the same
   element for the zoomed-CRT case, so this is that file's own idiom, not a new
   one. No transition of ours either: the inline style carries a 0.4s opacity
   transition that applies whoever sets the value. */
html[data-press-screenlook] .custom-title { opacity:0 !important; }
/* WARMING — mounted so the SitePal iframe can boot during the briefing screen,
   invisible and inert until the floor opens. See the note at the render site.
   Opacity and not display:none: a display:none subtree does not lay out, and a
   zero-sized iframe is exactly the case WebKit throttles. visibility:hidden is
   left off for the same reason. Nothing here is reachable — pointer-events off,
   and it sits behind the briefing panel. */
.ps-readstack.warming { opacity:0; pointer-events:none; z-index:0; }
.ps-readstack.ghost { opacity:.06; }
.ps-readstack.ghost:hover { opacity:1; }
.ps-readstack { transition:opacity .28s ease;
  position:absolute; left:18px; bottom:calc(var(--nav-clear) + 12px);
  width:min(430px, 38vw);
  max-height:calc(100vh - var(--nav-clear) - 96px);
  display:flex; flex-direction:column; gap:8px; }
/* min-height:0 IS LOAD-BEARING (no backticks in here — template literal): a
   flex child's default min-height is auto, so
   without it the column refuses to shrink below its content and the stack grows
   past its own max-height instead of scrolling — which would push the feed up
   under the top bar exactly the way the old corner tile got buried. */
/* THE LIVE CLAIM MAY NEVER SCROLL OFF ITS OWN TOP EDGE.
   This column used to scroll AS A WHOLE (overflow-y:auto here), which meant the
   answer and the transcript growing under the claim pushed the claim up and out
   — the reported symptom was the current sentence clipped mid-line while the
   record of older ones sat fully legible below it.
   Now the column itself does not scroll; each block owns its own overflow. The
   claim takes the free space and scrolls INSIDE its box if a long one needs to,
   so its first line is always at the top of the column. .pu-script-list has
   capped and scrolled itself at 190px since it was built, so the record was
   already well behaved; it just needed the column to stop moving underneath it. */
/* IT SCROLLS AGAIN, AND THE CLAIM STICKS INSTEAD.
   Three passes on this and the first two each traded one bug for its mirror:
   "overflow-y:auto" let the claim scroll off its own top edge; "overflow:hidden"
   pinned the claim but CLIPPED whatever ran past the bottom — and what runs past
   the bottom is the answer panel, whose last element is SEE WHAT LANDED. The
   button was rendered, invisible, and unreachable, which read as the control
   simply not existing (author, 2026-08-05: "nor is there a button available to
   look at the screen").
   A scroll container can never hide a control; sticky positioning can never let
   the claim leave. Using both is the only combination with neither failure.
   THE RULE FOR ANYONE EDITING THIS: nothing in this column may be unreachable.
   If a future change needs the claim pinned harder, pin it with position, not by
   taking the scroll away. */
.ps-readcol { flex:0 1 auto; min-height:0; overflow-y:auto;
  display:flex; flex-direction:column; gap:8px; }
/* THE CLAIM YIELDS, THE ANSWER DOES NOT (author, 2026-08-05: "Marisol's
   dialogue box is mostly stuck behind Virgil's").
   First pass gave the claim "flex:1 1 auto", which made it GREEDY — it took the
   free space and the answer, arriving under it in a column that no longer
   scrolls, got clipped mid-sentence. That traded the original bug for its
   mirror image.
   The answer is the thing the player just spent a question on and it is short;
   it never shrinks. The claim is long, already read, and re-readable, so it is
   the one that gives way and scrolls inside itself. */
/* STICKY, not flex-pinned: the claim rides the top of the scroller so it is
   always readable, and everything below scrolls under it. flex:none because a
   sticky item that can shrink stops being a reliable header. */
.ps-readcol > .pu-claim {
  position:sticky; top:0; z-index:2; flex:0 0 auto;
  /* Opaque, or the answer scrolls visibly through it. */
  background:linear-gradient(180deg, rgba(255,95,158,.07), rgba(2,16,14,.94) 60%),
             rgba(2,16,14,.94);
}
.ps-readcol > .pu-answer { flex:0 0 auto; }
.ps-readcol > .pu-script { flex:0 0 auto; }
/* AND IT OUTRANKS THE RECORD. Three blocks in one dark column at the same
   weight is the "busy" half of the report: nothing said which one was NOW.
   The live claim keeps the pink rule and gains the only lit background in the
   stack; the transcript recedes. Colour is not carrying this alone — the claim
   is also the only block at full text opacity. */
/* Background lives on the sticky rule above — it has to be OPAQUE there, and a
   second declaration down here would quietly win the cascade and make the claim
   translucent again, with the answer visible through it as it scrolls under. */
.ps-readcol > .pu-claim { border-left-width:3px; }
.ps-readcol > .pu-script { opacity:.72; }
.ps-readcol > .pu-script:hover, .ps-readcol > .pu-script.open { opacity:1; }
/* Over the room, so every block is opaque enough to read against anything.
   THE TRANSCRIPT WAS NOT. This rule said "both blocks" and there were two when
   it was written; ON THE RECORD arrived later with a hairline top rule and no
   background at all, so on this surface it hung under the answer as loose text
   with the room showing through — a character's head behind the record of what
   he said (author, 2026-08-02).
   It was never a scrolling problem: .pu-script-list has capped itself at 190px
   and scrolled since it was built. What it lacked was a box.
   Given one, the top rule that separated it from the answer becomes a left rule
   like the claim's, so the column reads as three stacked records rather than two
   panels and a tail. */
/* VIRGIL'S PLAYER — a standing monitor at the head of the stack, and the only
   lip-sync he can have on this surface (the glb cat has no face mesh; see the
   note by .ps-virgil's markup).

   NEVER HIDDEN, BY ANY MEANS. It used to fade to opacity 0 between his lines,
   which was safe but wrong-looking; what it must never do is go display:none,
   collapse to zero, or leave the viewport. A SitePal subframe with an empty clip
   rect is throttled by WebKit to ~0.1fps and returns FROZEN — audio untouched, so
   he talks with a still face and nothing looks broken enough to investigate.
   That is the exact failure this tile exists to cure.

   PINNED UNDER THE COLUMN, WITH HIS WORDS. It was absolutely positioned at
   left:18px top:64px — the one large area of the surface nothing else claimed,
   chosen because the reading column is bottom-anchored and grows upward, so
   anything sharing that corner is clear on claim one and buried by claim four.
   Making the column a FLEX CHILD dissolves that constraint rather than dodging
   it, and the block can then sit at the BOTTOM of the stack, where it is one
   panel with VirgilRead instead of a face at one end of the column and a
   sentence at the other. See the markup for why not a drawer off the seat row.

   A ROW, NOT A TILE: face left, read right. That is .pu-virgil's own shape —
   the block was always [portrait | text] and this only swaps a 34px still for a
   104px player, which is the whole idea in one line of markup. */
.ps-virgil { flex:none; display:flex; gap:10px; align-items:flex-start;
  padding:9px 11px; pointer-events:auto;
  background:rgba(2,16,14,0.9);
  border:1px solid rgba(191,238,222,0.24); border-left-width:2px;
  transition:border-color .3s ease, box-shadow .3s ease, background .3s ease; }
/* HE IS TALKING, AND THE PANEL SAYS SO FROM ACROSS THE SCREEN.
   The first version moved the border a shade and added a 20px shadow at 0.15,
   which is invisible against a room this bright — you had to already be looking
   at him to notice he had started, and his line is about three seconds long.
   A slow pulse is the right instrument: it reads as a live source rather than as
   a selection state, it cannot be mistaken for the claim panel's mood border
   (that one is pink and static), and it decays to nothing the moment he stops.
   ~1.6s is one breath — fast enough to catch the eye inside a short line, slow
   enough not to strobe under a paragraph of text. */
.ps-virgil.on { border-color:rgba(191,238,222,0.85);
  background:rgba(5,26,22,0.94);
  animation:psVirgilOnAir 1.6s ease-in-out infinite; }
@keyframes psVirgilOnAir {
  0%, 100% { box-shadow:0 0 14px rgba(191,238,222,0.16); }
  50%      { box-shadow:0 0 34px rgba(191,238,222,0.45); }
}
/* The feed lights with the panel — the frame around his face is the part the eye
   goes to, and leaving it dim while the box glowed read as a lit empty box. */
.ps-virgil.on .ps-virgil-feed { border-color:rgba(191,238,222,0.8);
  box-shadow:0 0 12px rgba(191,238,222,0.28); }
/* SQUARE, AND THE TILE FITS ITSELF TO IT. SitePalPortalTile measures this box and
   solves the scale against the player's 600x450, so the height here is the only
   number that matters — a square crops the 4:3 player at the sides, which is what
   a talking head wants. .spt-wrap is position:absolute; inset:0, so this must be
   a positioned box of its own.

   pointer-events off, alone in this block: he is not a seat, cannot be sent
   anywhere, and a clickable cat is an invitation to try. The tips switch beside
   him IS clickable, which is why the row itself takes the pointer. */
.ps-virgil-feed { position:relative; display:block; flex:none;
  width:104px; height:104px; overflow:hidden; pointer-events:none;
  border:1px solid rgba(191,238,222,0.28); background:#02100e;
  transition:border-color .3s ease, box-shadow .3s ease; }
.ps-virgil .pu-virgil { flex:1; min-width:0; }

/* HIM, LEADING. While the briefing runs he is the only thing happening, so the
   tile stops being a 104px thumbnail beside some text and becomes the screen he
   is talking out of: stacked, centred, ~5x the area. It reverts once the pitch
   has the floor, because claims need the column's width back for his read and a
   230px face over two lines of agenda is the same mistake in the other
   direction. Square, so the 4:3 player still crops at the sides rather than
   letterboxing — see the note on .ps-virgil-feed.
   NO BACKTICKS IN HERE: this block is inside a template literal. */
.ps-virgil.lead { flex-direction:column; align-items:center; gap:12px;
  padding:14px 12px 13px; }
.ps-virgil.lead .ps-virgil-feed { width:230px; height:230px; }
.ps-virgil.lead .ps-virgil-wait { align-items:center; text-align:center; }
.ps-virgil.lead .ps-virgil-rules { align-self:center; }
/* Before the first claim there is no read to show — see the markup. */
.ps-virgil-wait { display:flex; flex-direction:column; gap:4px; padding-top:2px; }
.ps-virgil-wait b { font:bold 10px/1.45 'Courier New',monospace;
  letter-spacing:0.11em; color:#bfeede; }
.ps-virgil-wait i { font-style:normal; font-size:11.5px; line-height:1.4;
  color:rgba(191,238,222,0.6); }
/* Deliberately quiet — a player who wants the rules again will look for them,
   and one who doesn't should not be invited to restart a 50-second beat. */
.ps-virgil-rules { align-self:flex-start; margin-top:2px; padding:2px 6px;
  font:10px/1.3 'Courier New',monospace; letter-spacing:0.06em;
  color:rgba(191,238,222,0.55); background:none; cursor:pointer;
  border:1px solid rgba(191,238,222,0.22); border-radius:3px; }
.ps-virgil-rules:hover { color:#bfeede; border-color:rgba(191,238,222,0.5); }
/* The pulse is the one thing here that must not run for a player who asked for
   stillness — so it becomes a steady bright glow, which carries the same "he is
   talking" reading without the motion. */
@media (prefers-reduced-motion:reduce) {
  .ps-virgil, .ps-virgil-feed { transition:none; }
  .ps-virgil.on { animation:none; box-shadow:0 0 28px rgba(191,238,222,0.4); }
}
.ps-readcol .pu-claim { background:rgba(2,16,14,0.86); }
.ps-readcol .pu-script {
  background:rgba(2,16,14,0.88);
  border-top:none; border-left:2px solid rgba(47,214,214,0.32);
  margin-top:0; padding:9px 12px 10px;
}
/* The inner scroller needs its own edge once the block has a background, or a
   clipped transcript ends on a hard cut that reads as the layout truncating it
   rather than as there being more. */
.ps-readcol .pu-script-list {
  -webkit-mask-image:linear-gradient(180deg, #000 calc(100% - 14px), transparent);
  mask-image:linear-gradient(180deg, #000 calc(100% - 14px), transparent);
}
.ps-readcol .pu-answer { animation:psin .25s ease both; }
@keyframes psin { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
/* The claim fades in with the camera cut; the answer has its own entrance. */
.ps-fade { opacity:0; transform:translateY(8px);
  transition:opacity .22s ease, transform .22s ease; }
.ps-fade.in { opacity:1; transform:none; }

.ps-dock { position:absolute; right:18px; bottom:calc(var(--nav-clear) + 12px); left:auto;
  display:flex; flex-direction:column; align-items:stretch; gap:9px;
  padding:11px 12px; background:rgba(2,16,14,0.9);
  border:1px solid rgba(47,214,214,0.25); }
.ps-dock .pu-meter { justify-content:flex-end; }

.ps-progress { position:absolute; left:18px; bottom:calc(var(--nav-clear) - 2px);
  display:flex; gap:6px; }
.ps-dot { width:22px; height:3px; background:rgba(234,255,249,0.18); }
.ps-dot.past { background:rgba(234,255,249,0.4); }
.ps-dot.now { background:#2fd6d6; }
.ps-dot.hit { background:#ffd23a; }
.ps-dot.black { background:#7a8b86; }

/* WIDTH AND HEIGHT ARE A BUDGET, NOT A CONTAINER. At 940 x ~600 this panel
   covered the desks, the nameplates and the projector — the room, which is the
   thing the whole surface exists to play inside of and the first thing the
   briefing hid. [A§18]'s first fix was "play happens in the room". Two cuts
   paid for the smaller box: the deal is named once instead of three times, and
   the house rules moved into the swap cell where they cost no height at all. */
.ps-open { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(800px, calc(100vw - 40px)); max-height:90vh; overflow:auto; flex-wrap:wrap;
  /* THE LAMP OVER THE INTAKE, lifted from .pf-wrap. On the phone the whole
     surface carries a warm radial at the top and it is most of why that screen
     reads as a lit terminal rather than a dark card. The panel is the surface
     here, so it carries it — under, not over, the flat base colour the record
     needs to stay legible against a moving room. */
  background:
    radial-gradient(120% 62% at 50% 0%, rgba(68,53,8,0.30), transparent 70%),
    rgba(2,16,14,0.94);
  border:1px solid rgba(47,214,214,0.4); border-left:3px solid #ff5f9e; padding:18px 22px;
  text-align:left;
  display:flex; gap:0; align-items:flex-start; }
/* THE PAGE CENTRES PARAGRAPHS. globals.css carries a bare p{text-align:center},
   which was invisible on this panel while every band was a div and centred both
   real paragraphs the moment the briefing grew some. It has to be an ELEMENT
   rule, not text-align on .ps-open: an inherited value loses to any rule that
   matches the element directly, however weak, so the panel-level declaration
   above does nothing for these two on its own.

   THE FLAT SURFACE IS STILL CENTRED HERE — same global, and .pf-directive /
   .pf-start-head p never opted out. At 330px under a 20px headline that reads as
   a choice; at this measure, under a 32px one, a centred paragraph between two
   left-aligned bands reads as a bug. Left is the deliberate version of what the
   phone is doing by accident. If the phone's centring turns out to be wanted,
   this is the one rule to delete. */
.ps-open p { text-align:left; }
/* SIX BANDS, EACH FULL WIDTH: rail, head, record, protocol, desk, action. It was
   four, two of which were side-by-side prose columns — see the render site for
   why those went. There are no columns left to keep balanced, so the flex gap is
   0 and every band owns its own top margin; a shared gap was making the tighter
   pairs (protocol → directive, section line → faces) sit as far apart as the
   loose ones. .ps-open-hero went with the same change, an era earlier: a 270px
   column was what forced the deal into two boxes, because a record that narrow
   can name a client but cannot describe one. */
.ps-open > * { flex-basis:100%; }

/* BAND 0's rail is gone with its markup (2026-08-05) — .ps-market-rail and its
   four descendant rules. See the render site for why three constants are not an
   instrument. The head is the panel's top edge now. */

/* BAND 1 — THE HEAD. The one display face on the panel other than the record's
   letterhead, and it is Orbitron rather than Bebas because this is the terminal
   speaking, not the paperwork. Two lines, the second in gold: the instruction
   splits into what you do and what you do it for, and colouring the second half
   is what keeps a 34px headline from reading as a single shout. */
/* No top margin: with the rail cut this is the first band, and its offset from
   the panel edge is .ps-open's own padding. The old 12px was clearance from the
   rail beneath it. */
.ps-start-head { margin:0; }
.ps-start-head h1 {
  margin:7px 0 7px; font-family:'Orbitron','IoskeleyMono',monospace;
  color:#eafff9; font-size:32px; line-height:1.06; letter-spacing:.04em;
  font-weight:700;
}
.ps-start-head h1 span {
  color:#ffd23a; text-shadow:0 0 22px rgba(255,210,58,.24);
}
/* MEASURE. The panel runs ~97ch of monospace at full width, about three times a
   comfortable read — which is what the deleted prose band needed two columns to
   escape. One short line held to ~62ch needs no column at all. */
.ps-start-head p {
  margin:0; max-width:62ch; color:#81aaa4; font-size:13px;
  line-height:1.45; letter-spacing:.035em;
}
/* GOLD, NOT PINK. It was #ff5f9e as the copy column's eyebrow, where the pink
   agreed with the record's left rule two inches away. Above a gold headline it
   was the third accent in four lines. */
.ps-open-eyebrow { font-size:11px; letter-spacing:.2em; color:#ffd23a; font-weight:bold; }

/* BAND 3 — THE HOUSING. See the render site for why the record now sits in one.
   The 28px top padding is the TAB BAND and the paperclip's headroom: the deal
   file's tab rides the record's top edge at -17px and the polaroid's clip
   reaches ~27px above it — the shell's clip-path would shear the loop at
   anything shallower (PressFlat carries the same 28 for the same reason). The
   readout that used to occupy this padding is gone — see the render site.
   CAPPED AND CENTERED (author, 2026-08-03: "folder looks too wide"): a folder
   has folder proportions, and at the panel's full ~940px it read as a banner.
   640px keeps the open record's three columns comfortable, with flex-wrap's
   particulars-drop as the designed degradation a few px below that — and the
   flat surface runs the same record at 520, stacked, so every narrower shape
   is already proven. The folder reads as an object on the desk rather than a
   stripe across it. */
/* THE INTAKE ROW. align-items:start so the guide card sits at the file's top
   edge rather than stretching to its height — a column of card that tall would
   be a panel, and it is a caption with a face on it.
   THE GUIDE'S WIDTH IS FIXED AND THE FILE TAKES THE REST, not the other way
   round: the card has a floor below which the role line wraps, and the folder is
   the element that degrades gracefully at any width (that is what the container
   query in engagement.jsx is for). */
.ps-intake { display:flex; align-items:flex-start; gap:14px; margin-top:14px; }
/* margin:0 is not tidying — the shell carries margin-left/right:auto
   for its old centred life, and an auto margin on a flex item eats free space
   before justify-content ever sees it. */
.ps-intake .ps-record-shell {
  flex:1 1 auto; min-width:0; max-width:none; margin:0;
}

/* VIRGIL ON THE BRIEFING — see the render site for why this placement is safe
   where the old one wasn't. Deliberately quiet: no border box competing with the
   file's housing beside it, no accent colour but his own mint. He is the second
   object in the row and must not out-shout the first. */
.ps-guide {
  /* STRETCH TO THE FILE, CENTRE INSIDE IT. align-self:stretch alone left the
     portrait at the top of a 320px card with 170px of empty box under it, which
     reads as a column that failed to load. The card matching the file's height
     is what makes the row a row rather than a folder with a sticker beside it,
     so the height stays and the content moves to the middle of it. */
  flex:0 0 218px; align-self:stretch;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  text-align:center; padding:14px 12px; gap:4px;
  border:1px solid rgba(191,238,222,.22);
  background:linear-gradient(160deg,rgba(12,32,28,.72),rgba(2,14,13,.72));
  clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));
}
.ps-guide-pic {
  width:84px; height:84px; object-fit:cover; border-radius:50%;
  border:1px solid rgba(191,238,222,.45); background:#020f0d;
}
.ps-guide-who {
  margin-top:8px; font-size:11px; font-weight:bold; letter-spacing:.1em;
  color:#eafff9;
}
/* HIS ROLE LINE IS THE WHOLE PITCH FOR HIM (virgil.js) — the one string on this
   card that has to read, so it gets the mint and the letterspacing. */
.ps-guide-role { font-size:9px; letter-spacing:.13em; color:#bfeede; }
.ps-guide-blurb {
  margin:7px 0 0; font-size:10.5px; line-height:1.45;
  color:rgba(234,255,249,.62); text-align:center;
}
/* THE COVERAGE LIST. Ruled off from Virgil's own three lines, because it is
   about somebody else — the rule is doing the job the deleted band's divider
   did, one level up: his identity above it, the desk's below it. */
.ps-guide-lanes {
  width:100%; margin-top:15px; padding-top:12px;
  border-top:1px solid rgba(191,238,222,.18);
}
.ps-guide-lanes > span {
  display:block; font-size:8px; letter-spacing:.18em;
  color:rgba(191,238,222,.55);
}
.ps-guide-lanes ul {
  list-style:none; margin:8px 0 0; padding:0;
  display:flex; flex-direction:column; gap:9px;
}
/* Gold, which is what .ps-face-role wore — the roles are what survived that
   band, so they keep its colour. The NAME is the quieter of the two lines on
   purpose: what the player has to hold going in is the coverage, and the name
   is how they'll ask for it. */
.ps-guide-lanes li { font-size:9.5px; letter-spacing:.12em; color:#ffd23a; }
.ps-guide-lanes li b {
  display:block; margin-bottom:2px;
  font-size:10px; font-weight:bold; letter-spacing:.04em;
  color:rgba(234,255,249,.92);
}

.ps-record-shell {
  position:relative; margin-top:14px; padding:28px 10px 10px;
  max-width:640px; margin-left:auto; margin-right:auto;
  border:1px solid rgba(47,214,214,.3);
  background:linear-gradient(145deg,#19211f,#08100f 34%,#020504 78%);
  box-shadow:0 10px 26px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.025);
  clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));
}
.ps-record-shell::before {
  content:""; position:absolute; inset:4px; pointer-events:none;
  border:1px solid rgba(255,210,58,.12);
}

/* The record stays a document, but tinted to the housing it now sits in — the
   scanline wash is what stops a pale form floating inside a dark instrument. */
.ps-open .eng {
  border-color:rgba(255,210,58,.24); border-left-color:rgba(239,98,220,.65);
  background:
    repeating-linear-gradient(0deg,rgba(0,0,0,.12) 0 1px,transparent 1px 3px),
    linear-gradient(180deg,rgba(8,26,23,.92),rgba(1,10,9,.94));
}
.ps-open .eng.in { border-color:rgba(255,210,58,.48); }
.ps-open .eng-title { font-family:'Orbitron','IoskeleyMono',monospace; font-size:14px; }

/* THE SEALED-STATE CSS IS GONE WITH ITS MARKUP (2026-08-03), and the collapse
   hacks (--seal-band, the :not(.in) 1px/visibility pattern) went with it: the
   record renders its full blank form at rest — mounted, in flow, covering its
   own rest state — and the deal file's cover (see ENGAGEMENT_CSS) is what
   withholds it. Do not reintroduce a rest-state overlay here; anything the rest
   state wants to say belongs on the cover, and the cover already says
   everything a closed file needs to. The desktop record wears the cover at its
   own width — the cover is inset over the record, so no per-surface geometry. */

/* BAND 2 — THE PROTOCOL, above the file since 2026-08-05 (see the render site).
   Three counts, baseline-aligned so the numerals read as a row of values rather
   than three stacked captions. */
.ps-protocol {
  display:grid; grid-template-columns:repeat(3,1fr); margin-top:14px;
  border:1px solid rgba(255,210,58,.2); background:rgba(42,34,7,.12);
}
.ps-protocol div {
  min-width:0; padding:11px 14px 10px; display:flex; align-items:baseline; gap:8px;
}
.ps-protocol div + div { border-left:1px solid rgba(255,210,58,.14); }
.ps-protocol b {
  color:#ffd23a; font-family:'Orbitron','IoskeleyMono',monospace;
  font-size:20px; font-weight:600;
}
.ps-protocol span { color:#91b7b0; font-size:9.5px; letter-spacing:.11em; }
/* THE RULE UNDER THE COUNT. Stacked rather than run on, so ANALYSTS stays the
   same word at the same size as QUESTIONS and FINAL CALL — the row reads as
   three counts first, and the scarcity is a note on one of them. */
.ps-protocol span i {
  display:block; margin-top:3px;
  color:rgba(255,210,58,.6); font-style:normal; font-size:8px; letter-spacing:.13em;
}
.ps-directive { margin:11px 2px 0; max-width:78ch; color:#b7d5cf; font-size:13px; line-height:1.5; }

/* BAND 4 AND ITS SECTION LINE ARE GONE (2026-08-05) — .ps-section-line,
   .ps-tools, .ps-draw-row, .ps-face*, and the hover-zoom media query with them.
   See the note at the render site for what the band was and why the floor's
   seat row does its job. Nothing else on this surface used these classes; the
   floor's portraits are SeatRow in pressUi.jsx, which never shared them. */

/* THE ARRIVAL — record styles come from engagement.jsx's ENGAGEMENT_CSS,
   prepended to this sheet. What's local to this surface is the skip target. */
.ps-skip-deal { position:absolute; inset:0; z-index:5; background:none; border:none;
  padding:0; cursor:pointer; }

/* ---- putting the brief down (briefHidden) ----
   Visibility rides with opacity so the hidden panel takes no clicks and no tab
   stops: a briefing you cannot see but can still tab into is the same trap as
   one you cannot dismiss. The transform is small on purpose — it reads as the
   sheet being set down rather than as a modal being thrown. */
.ps-open { transition:opacity .3s ease, transform .3s ease, visibility 0s linear 0s; }
.ps-open.hid { opacity:0; visibility:hidden; transform:translate(-50%,-46%) scale(.985);
  transition:opacity .3s ease, transform .3s ease, visibility 0s linear .3s; }
/* The ✕ sits ON the panel's top-right corner, outside the content flow so no
   band has to make room for it. z-index above .ps-skip-deal's sheet for the
   frames either side of the "rolling" gate. */
.ps-brief-hide { position:absolute; top:8px; right:10px; z-index:6;
  padding:6px 10px; cursor:pointer; border-radius:3px;
  background:rgba(0,0,0,.35); border:1px solid rgba(255,210,58,.35);
  color:#ffd23a; font:bold 10px/1 'Courier New',monospace; letter-spacing:.12em;
  transition:background .15s ease, border-color .15s ease; }
.ps-brief-hide:hover { background:rgba(255,210,58,.16); border-color:#ffd23a; }
/* THE WAY BACK, and it is deliberately the loudest small thing on an otherwise
   empty screen — the panel it restores is the only place the deal is written
   down, so this may never read as decoration. Same corner the ✕ was in, so the
   gesture reverses where it happened. */
.ps-brief-back { position:absolute; top:16px; right:18px; z-index:7;
  padding:8px 14px; cursor:pointer; border-radius:3px;
  background:rgba(4,20,15,.92); border:1.5px solid #ffd23a; color:#ffd23a;
  font:bold 11px/1 'Courier New',monospace; letter-spacing:.14em;
  box-shadow:0 0 18px rgba(255,210,58,.22);
  animation:psin .3s ease both;
  transition:background .15s ease; }
.ps-brief-back:hover { background:rgba(255,210,58,.18); }
/* THE ONE BUTTON ON THE BRIEFING, and it was the most templated thing on a
   screen that owns a blackletter sign and a neon window: a full-width hairline
   rectangle. Scoped to this row so the shared .ps-lock (the call, the autopsy)
   is untouched. */
/* FULL PANEL WIDTH, as the third wrapped flex item. Sitting inside the copy
   column it started 292px in from the panel's left edge, and since the record is
   shorter than the copy the bottom-left quadrant was empty under it. One action
   for the whole briefing should span the whole briefing. */
/* THE INGOT. It was a flat top-lit gold slab in Bebas — the same button every
   site ships — and the flat surface replaced it with a bar that is lit ACROSS
   rather than down, bevelled at opposite corners like the housing above it, and
   ruled inside its own edge. Ported verbatim apart from the type size: one beat,
   one button. Bebas is gone from it because Orbitron is the terminal's voice and
   the record's letterhead is the only thing on the panel that should be Bebas. */
/* STICKY TO THE FOOT OF THE PANEL, as .pf-cta-row is on the phone. The briefing
   is ~660px of bands and 90vh on a 13" laptop is ~630, so the one button was the
   thing that fell off the bottom. (The record no longer grows at the reveal —
   the blank form under the deal file's cover locks its height from rest — but
   the briefing was already taller than a short laptop without it.) A briefing
   whose only action is below the fold reads as a surface with nothing to press,
   which is the exact report that put this CTA back (author, 2026-07-27).

   The negative bottom and matching negative margin are what make it sit FLUSH
   with the panel's padding edge instead of floating 18px above it: sticky offsets
   are measured from the scrollport, which includes .ps-open's padding. */
.ps-cta-row { flex-basis:100%; display:flex; align-items:center; gap:14px;
  position:sticky; z-index:4; bottom:-18px;
  margin:16px 0 -18px; padding:12px 0 18px;
  background:linear-gradient(0deg, rgba(2,16,14,0.97) 74%, transparent); }
.ps-cta-row .ps-lock {
  position:relative; overflow:hidden;
  flex:1; width:auto; margin-top:0;
  font-family:'Orbitron','IoskeleyMono',monospace;
  font-size:17px; letter-spacing:0.13em; padding:15px 13px; text-align:center;
  color:#07100d; border:1px solid rgba(255,210,58,.8);
  background:linear-gradient(90deg,#3a2d05,#ffd23a 48%,#3a2d05);
  text-shadow:0 1px rgba(255,255,255,.25);
  box-shadow:0 0 24px rgba(255,210,58,.22), inset 0 0 22px rgba(255,255,255,.14);
  clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));
  transition:filter .18s ease, box-shadow .18s ease;
}
.ps-cta-row .ps-lock::after {
  content:""; position:absolute; inset:5px; pointer-events:none;
  border:1px solid rgba(5,15,12,.23);
}
.ps-cta-row .ps-lock:hover:not(:disabled) {
  filter:brightness(1.09);
  box-shadow:0 0 34px rgba(255,210,58,.4), inset 0 0 22px rgba(255,255,255,.18);
}
/* The clip-path eats an outline drawn on the border box, so focus has to be
   offset clear of it — otherwise the ring is invisible at the four bevels. */
.ps-cta-row .ps-lock:focus-visible { outline:1px solid #fff; outline-offset:3px; }
.ps-cta-row .ps-lock:disabled {
  background:#25312e; border-color:rgba(142,171,165,.28); color:#6d8781;
  box-shadow:none; cursor:default;
}


/* .ps-open-name/.ps-open-sub are gone — the deal is named on the record, once. */

.ps-panel { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(520px, calc(100% - 40px)); background:rgba(2,16,14,0.95);
  border:1.5px solid rgba(47,214,214,0.55); padding:22px; text-align:center; }
.ps-panel.wide { width:min(640px, calc(100% - 40px)); text-align:left; }
/* right column — leaves the left of the frame to the characters */
.ps-panel.side { left:auto; right:18px; top:50%; transform:translateY(-50%);
  width:min(430px, calc(100% - 36px)); text-align:left; }
.ps-panel.scroll { max-height:78vh; overflow-y:auto; }
/* header / scrolling body / pinned exit */
.ps-panel.autopsy { max-height:78vh; display:flex; flex-direction:column; gap:0; }
.ps-au-body { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch; padding-right:4px; margin-bottom:12px;
  /* the last line fades, so it reads as "there is more" rather than "that's all" */
  -webkit-mask-image:linear-gradient(180deg, #000 calc(100% - 18px), transparent);
  mask-image:linear-gradient(180deg, #000 calc(100% - 18px), transparent); }
.ps-panel.autopsy .ps-lock { flex:none; margin-top:0; }

/* THE PATTERN BLOCK HAD NO DESKTOP CSS AT ALL — the only .ps-pattern rule lived
   inside the 860px media query, so above that width it fell back to display
   :block: the card stacked on top of unstyled body copy, ~500px of it, which is
   what pushed the exit off the bottom. Card left, copy right, both sized. */
.ps-pattern { display:flex; gap:12px; align-items:flex-start; margin-bottom:18px;
  padding:12px; border:1px solid rgba(255,210,58,0.28); background:rgba(255,210,58,0.05); }
.ps-pattern-copy { flex:1; min-width:0; }
/* THIS deal, tied to the pattern by name. The line that was missing, and whose
   absence made the exemplar look like the subject of the screen. */
.ps-pattern-was { font-size:12px; color:rgba(234,255,249,0.85); margin-bottom:10px; }

/* The tell, boxed so it reads as the portable lesson rather than more prose
   about this one deal. */
.ps-pattern-case { padding:9px 11px; margin-bottom:10px;
  border:1px solid rgba(255,210,58,0.22); background:rgba(0,0,0,0.28); }
.ps-pattern-caselabel { font:bold 8px/1.4 'Courier New',monospace;
  letter-spacing:0.13em; color:rgba(255,210,58,0.7); margin-bottom:4px; }
.ps-pattern-label { font:bold 9px/1.4 'Courier New',monospace; letter-spacing:0.13em;
  color:rgba(255,210,58,0.8); }
.ps-pattern-name { font-size:15px; font-weight:bold; letter-spacing:0.04em; margin:4px 0 6px; }
.ps-pattern-note { font-size:11.5px; line-height:1.45; color:rgba(234,255,249,0.82); }
.ps-pattern-foot { font-size:10.5px; line-height:1.4; color:rgba(234,255,249,0.5);
  margin-top:7px; font-style:italic; }

/* THE LOWER THIRD — reveal copy that never covers the curtain call. */
.ps-lower { position:absolute; left:18px; right:18px; bottom:64px;
  display:flex; align-items:center; gap:20px; padding:16px 20px;
  background:linear-gradient(180deg, rgba(2,16,14,0.62), rgba(2,16,14,0.92));
  backdrop-filter:blur(3px); border-top:2px solid rgba(47,214,214,0.55);
  animation:pslower .32s ease both; }
@keyframes pslower { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
.ps-lower-pnl { font-size:44px; font-weight:bold; letter-spacing:0.03em; flex:none;
  min-width:118px; text-align:center; }
.ps-lower-pnl.up { color:#4dffaa; text-shadow:0 0 22px rgba(77,255,170,0.5); }
.ps-lower-pnl.down { color:#ff5f6f; text-shadow:0 0 22px rgba(255,95,111,0.5); }
.ps-lower-body { flex:1; min-width:0; }
.ps-lower-h { font-size:11px; letter-spacing:0.16em; font-weight:bold; color:#2fd6d6; }
.ps-lower-truth { font-size:12.5px; line-height:1.5; margin-top:5px;
  color:rgba(234,255,249,0.9); }
/* THE SETTLEMENT NOTE — set apart from the truth line rather than styled as
   more of it. It is a different KIND of sentence: the truth line says what
   happened, this says why the number disagrees with it. Rule above, dimmer,
   italic. It must not read as gold — gold is the receipt colour on this
   surface, and this is commentary, not evidence. */
.ps-lower-note { font-size:11.5px; line-height:1.45; margin-top:7px; padding-top:7px;
  border-top:1px solid rgba(234,255,249,0.16);
  color:rgba(234,255,249,0.62); font-style:italic; }
.ps-lower-go { flex:none; background:none; border:1px solid #ffd23a; color:#ffd23a;
  font-size:11.5px; letter-spacing:0.1em; padding:12px 18px; cursor:pointer; }
.ps-lower-go:hover { background:rgba(255,210,58,0.12); }
.ps-panel-h { font-size:12px; letter-spacing:0.16em; color:#2fd6d6; font-weight:bold; margin-bottom:16px; }
.ps-slider { width:100%; accent-color:#ff2d6f; }
.ps-slider-ends { display:flex; justify-content:space-between; font-size:10px;
  letter-spacing:0.12em; color:rgba(234,255,249,0.5); margin-top:4px; }
.ps-saying { font-size:16px; margin-top:18px; }
.ps-risk { font-size:12.5px; color:#ffd23a; margin-top:8px; }
/* QUIETER THAN THE RISK LINE IT EXPLAINS. It is the footnote to the two numbers
   above, not a third number competing with them — cyan-dim, a rule to tie it to
   the line it annotates, and it must never pull the eye off the gauge. */
.ps-stakenote { font-size:11px; line-height:1.5; color:rgba(191,238,222,0.62);
  margin-top:10px; padding-top:8px; border-top:1px solid rgba(47,214,214,0.18); }
.ps-lock { margin-top:4px; width:100%; background:none; border:1px solid #ffd23a;
  color:#ffd23a; font-size:13px; letter-spacing:0.12em; padding:13px; cursor:pointer; }
.ps-pnl { font-size:44px; font-weight:bold; letter-spacing:0.04em; }
.ps-pnl.up { color:#4dffaa; } .ps-pnl.down { color:#ff5f6f; }
.ps-lower-pnl.flat, .ps-pnl.flat { color:rgba(234,255,249,0.55); }
/* The bet restated against the outcome — gold, like every other line on this
   surface that is about the players own commitment rather than the deal. */
.ps-lower-bet { color:#ffd23a; font-size:12.5px; line-height:1.5; margin:6px 0 10px; }
.ps-truth { font-size:13px; line-height:1.55; margin-top:14px; color:rgba(234,255,249,0.85); }
.ps-scores { display:flex; gap:28px; margin-bottom:6px; }
.ps-scores span { font-size:10px; letter-spacing:0.12em; display:block; }
.ps-scores b { font-size:24px; color:#ffd23a; }
.ps-readnote { font-size:12px; color:rgba(234,255,249,0.7); margin-bottom:16px; }
.ps-au { border-left:2px solid rgba(234,255,249,0.16); padding:8px 0 8px 12px; margin-bottom:12px; }
.ps-au.pressed { border-left-color:#ffd23a; }
.ps-au-fact { font-size:12.5px; }
.ps-au-verdict { font-size:11.5px; color:#2fd6d6; margin-top:4px; letter-spacing:0.04em; }
.ps-au-you { font-size:10.5px; color:#ffd23a; margin-top:3px; }

/* SHORT VIEWPORTS — the briefing is ~760px tall at desktop metrics, and 90vh on
   a 13" laptop is ~630. The panel scrolls, so nothing is unreachable, but the
   thing that falls off the bottom is the ONE BUTTON, and a briefing whose only
   action is below the fold reads as the surface having nothing to press — the
   exact report that put this CTA back in the first place (author, 2026-07-27).

   HEIGHT, NOT WIDTH. The bands are all full-width and fine at 800px; what runs
   out on a laptop is vertical room, and keying this off max-width would compact
   a tall narrow window that has no need of it. */
@media (max-height: 820px) {
  .ps-start-head h1 { margin:5px 0 5px; font-size:25px; }
  .ps-start-head p { font-size:12px; }
  .ps-intake { margin-top:9px; }
  .ps-record-shell { padding:28px 9px 8px; }
  .ps-guide { padding:11px 10px; }
  .ps-guide-pic { width:70px; height:70px; }
  .ps-open .eng-frame { width:62px; }
  .ps-protocol { margin-top:9px; }
  .ps-protocol div { padding:8px 14px 7px; }
  .ps-protocol b { font-size:17px; }
  .ps-directive { margin-top:9px; font-size:12px; }
  /* Only the top margin moves — the -18px bottom is the sticky flush offset and
     tracks .ps-open's padding, not the band rhythm. */
  .ps-cta-row { margin-top:10px; padding-top:9px; }
  .ps-cta-row .ps-lock { font-size:15px; padding:11px 13px; }
}

/* SHORTER STILL — the three cuts above (status rail, analyst band, head subline)
   put the briefing at 676px in a 676px slot on a 779px window, which is exactly
   no scroll and no headroom. Below ~760px of window the panel would start
   scrolling again, and the folder is where the room has to come from: it is 58%
   of the panel, and the other four bands are a headline, three numbers, one
   sentence and the button — none of which has slack.

   SHRINK IT, DO NOT SQUASH IT. Capping the width and letting the derived height
   follow keeps the ~1.6 ratio the folder was rebuilt for; taking the height
   alone would flatten it back toward the 2:1 banner that started all this. 520
   is the floor, not a preference — below it the file crosses its own 519px
   container query and flips to the narrow layout, which moves the stamps to a
   foot band and makes the folder TALLER, not shorter. */
@media (max-height: 760px) {
  .ps-intake { margin-top:7px; }
  .ps-record-shell { padding:24px 9px 7px; }
  .ps-protocol { margin-top:7px; }
  .ps-directive { margin-top:7px; }
  .ps-cta-row { margin-top:8px; padding-top:7px; }
}

/* NARROW WINDOWS UNSTACK THE INTAKE ROW. The panel is min(800px, 100vw - 40px),
   so below ~760px of viewport the row is dividing less than 700px between a
   folder and a 218px card — which pushes the file under its 400px container
   query, into the layout that makes it taller. Stacking is the cheaper outcome:
   the file goes full width and the guide becomes a wide short card beneath it,
   which is also the order he is read in (the file arrives, then the cat tells
   you what to do with it). */
@media (max-width: 760px) {
  .ps-intake { flex-wrap:wrap; }
  .ps-intake .ps-record-shell { flex-basis:100%; }
  /* Grid, not a row of flex items: the portrait has to span all three text
     lines, which flex-direction:row cannot express without a wrapper element. */
  .ps-guide {
    flex:1 1 100%; align-self:auto;
    display:grid; grid-template-columns:auto 1fr; align-items:center;
    column-gap:12px; row-gap:0; text-align:left;
  }
  /* 1 / -1, not a row count: the card gained a fourth child and a hard-coded
     span would have left the coverage list under the portrait instead of beside
     it. This spans whatever is there. */
  .ps-guide-pic { width:56px; height:56px; grid-row:1 / -1; align-self:start; }
  .ps-guide-who { margin-top:0; }
  .ps-guide-blurb { margin:3px 0 0; text-align:left; }
  /* Horizontal at this width — four short roles fit one line and a stacked list
     would double the card's height for no gain. */
  .ps-guide-lanes { margin-top:8px; padding-top:8px; }
  .ps-guide-lanes ul { flex-direction:row; flex-wrap:wrap; gap:4px 16px; margin-top:5px; }
}

@media (max-width: 860px) {
  /* The reading column and the dock stop competing for the width and stack. */
  .ps-readstack { width:calc(100% - 36px); right:18px; max-height:44vh; }
  /* The feed shrinks rather than going away — hiding it is the one thing that is
     not allowed (an off-screen subframe is a throttled subframe). */
  .ps-virgil-feed { width:78px; height:78px; }
  /* .ps-open-aside / .ps-tool-hand / .ps-tool-who went with the prose columns and
     the tool-group wrappers — every briefing band is full width at every size
     now, so the panel needs no direction flip here. What it DOES need is the head
     scaled down: 34px Orbitron over two lines is ~26% of a short viewport. */
  .ps-start-head h1 { font-size:26px; }
  .ps-protocol b { font-size:17px; }
  .ps-cta-row .ps-lock { font-size:15px; }
  .ps-pattern { flex-direction:column; align-items:center; text-align:center; }
  /* no room for a lower third beside a number — stack it */
  .ps-lower { flex-direction:column; align-items:stretch; gap:10px; text-align:center; }
  .ps-lower-pnl { font-size:34px; min-width:0; }
  .ps-lower-go { width:100%; }
  .ps-panel.side { left:18px; right:18px; width:auto; max-height:70vh; }
  .ps-panel.autopsy { max-height:70vh; }
  .ps-dock { left:18px; right:18px; }
  .ps-dock .pu-seats { justify-content:center; }
}
`;
