"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, rollSeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, PITCHER, SEATS, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, DESK_ORDER, PITCH_BOT, laneOwner, laneSentence, pitchOpening, pitcherAside, seatMeta } from "@/game/terminal-traders/press/desk";
import { VIRGIL, virgilRead } from "@/game/terminal-traders/press/virgil";
import {
  PHASE, PRESSES, STAKE,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, coverageScore, seatOptions, laneOutlook, pressure,
} from "@/game/terminal-traders/press/pressRun";
import { preloadSfx } from "@/lib/uiSfx";
import { speakAdviserLine, stopAdviserAudio, unlockAdviserAudio } from "@/lib/counselSpeech";
import { playUnicornBeat, stopUnicornBeat } from "@/lib/trade/playUnicornBeat";
import { setPitchBotPressure, getPitchBotVoice } from "@/lib/trade/pitchBotScene";
import { setUnicornGlow } from "@/lib/trade/unicornGlow";
import {
  EngagementRecord, runArrival, endArrival, prefersReducedMotion, SFX,
  ENGAGEMENT_CSS, peekFileNo, commitFileNo,
} from "./engagement";
import { createEvidenceScreen, SCREEN_AGENTS } from "./evidenceScreen";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, AnswerChoice, OpeningBody, SeatRow,
  Meter, Nav, Transcript, readDwellMs, PRESS_UI_CSS,
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
  const [claimVisible, setClaimVisible] = useState(false);
  // The opening beat. You land on the wide desk shot and start when you're
  // ready. This is also load-bearing technically: the scene resets the camera
  // to sceneDefaultPose when the model finishes loading, so any focus set
  // before that gets clobbered. Gating on a click means the model is always
  // loaded by the time we ask for a camera move — no race, no retry loop.
  const [started, setStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Transcript open by default: its whole value is being able to re-read claim 2
  // while claim 5 is on the floor, and a panel you have to discover first mostly
  // doesn't get discovered.
  const [script, setScript] = useState(true);
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
  const [opened, setOpened] = useState(false);
  const floorLive = onFloor && opened;

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
  useEffect(() => {
    onSpeechActive?.(onFloor && speaking);
    return () => onSpeechActive?.(false);
  }, [onFloor, speaking, onSpeechActive]);

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
    if (rolling) tlRef.current?.progress(1);
  }, [rolling]);

  /* ---- it says it out loud ----
     Token-guarded, and the guard is not optional: a press interrupts the claim
     mid-sentence, so two utterances are briefly in flight. The one being cut off
     resolves through stopAdviserAudio and would otherwise land its `finally`
     AFTER the reply started, reporting "stopped" over live audio and dropping the
     room back to a non-speaking idle for the whole answer. Only the newest
     utterance may say it has stopped. (Learned on PressFlat; ported verbatim.) */
  const sayToken = useRef(0);

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
  useEffect(() => {
    if (!floorLive || !claim) return;
    sayTurn([{ voice: VOICE, text: claim.spin, agent: PITCHER_AGENT }]);
    return () => { try { stopAdviserAudio(); } catch {} try { stopUnicornBeat(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorLive, run.claimIndex]);

  useEffect(() => () => {
    try { stopAdviserAudio(); } catch {}
    try { stopUnicornBeat(); } catch {}
  }, []);

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
   * Everyone else has no rig here (the analysts are static in-room and the pitcher
   * has a screen for a face), so speakAdviserLine is right for them.
   *
   * DELIBERATELY DESKTOP-ONLY. PressFlat has no unicorn — no 3D at all — so it
   * keeps speakAdviserLine for Eugene. This is a presentation difference, not a
   * rule, which is exactly the kind of thing §6 says belongs in the surface.
   */
  const speakLine = useCallback(async (voice, text) => {
    if (voice === "EU") {
      // Same hooks the lobby passes, so the horn glow comes along with the jaw.
      await playUnicornBeat({ line: text }, { setGlow: setUnicornGlow });
      return;
    }
    await speakAdviserLine(voice, text);
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
   */
  const sayTurn = useCallback(async (parts, { onPart = null, dwell = null } = {}) => {
    const live = parts.filter((p) => p && p.text);
    if (!live.length) return;
    const token = ++sayToken.current;
    setSpeaking(true);
    try {
      for (let i = 0; i < live.length; i++) {
        const p = live[i];
        if (sayToken.current !== token) return;   // superseded — stop the chain
        onPart?.(i);
        // THE CAMERA FOLLOWS THE VOICE, NOT THE PRESS. It used to cut to whoever
        // answered and then sit there while the PITCHER replied — so you watched
        // Eugene's back through the agent's whole line (author, 2026-07-29). Each
        // utterance owns the frame while it plays, which is what "on a press it's
        // the camera that crosses the room" was always supposed to mean.
        if (p.agent) onFocusAgent?.(p.agent);
        const startedAt = Date.now();
        try { await speakLine(p.voice || VOICE, p.text); }
        catch { /* voice is enrichment, never a gate on play */ }
        // A DWELL FLOOR, because the camera move is now tied to audio that may
        // not arrive. With no API key speakLine resolves almost instantly and the
        // two cuts collapse into one strobe across the desk; the shot has to hold
        // long enough to read as a shot even in silence.
        const left = (dwell ? dwell(p.text) : MIN_DWELL_MS) - (Date.now() - startedAt);
        if (left > 0) await new Promise((r) => setTimeout(r, left));
      }
    } finally {
      if (sayToken.current === token) setSpeaking(false);
    }
  }, [onFocusAgent, speakLine]);

  /* ---- it introduces itself ----
     Runs once per session, on the first frame of the floor. No cleanup that stops
     audio: on a natural finish there is nothing left playing, and the two ways it
     can end early — SKIP and unmount — are handled by skipOpening and by the
     unmount effect below. Adding one here would race the claim effect, which
     starts speaking in the same commit that `opened` flips. */
  useEffect(() => {
    if (!onFloor || opened || !openingLines.length) return;
    let alive = true;
    (async () => {
      await sayTurn(
        openingLines.map((text) => ({ voice: VOICE, text, agent: PITCHER_AGENT })),
        { onPart: (i) => { if (alive) setOpeningAt(i); }, dwell: readDwellMs });
      if (alive) setOpened(true);
    })();
    return () => { alive = false; };
  }, [onFloor, opened, openingLines, sayTurn]);

  // Impatience is a legitimate input here as much as on the arrival (skipRoll).
  // Bumping the token is what supersedes the chain in flight — its `finally` then
  // declines to touch `speaking`, so this has to clear it by hand.
  const skipOpening = useCallback(() => {
    sayToken.current++;
    try { stopAdviserAudio(); } catch {}
    try { stopUnicornBeat(); } catch {}
    setSpeaking(false);
    setOpened(true);
  }, []);

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

    // You INTERRUPTED it — the claim it was mid-way through stops. sayTurn's
    // token does this for us, but only once the new chain starts; stopping here
    // means the room never carries two voices across the gap.
    try { stopAdviserAudio(); } catch {}

    const owed = claim.id;
    replyFor.current = owed;
    // ONE VOICE, ON ITS OWN CAMERA. The second part of this chain used to be the
    // pitcher's reaction; it now waits behind a button.
    Promise.all([
      sayTurn([solo
        ? { voice: VOICE, text: outcome.barronSays, agent: PITCHER_AGENT }
        : {
          voice: seatMeta(outcome.seat)?.voice,
          text: outcome.adviserSays,
          agent: seatMeta(outcome.seat)?.agentId,
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
    setFlash((f) => (f ? { ...f, looked: true } : f));
  }, [flash, onFocusAgent]);

  // LET IT ANSWER. Its own camera, its own voice — the handover sayTurn used to
  // make on its own the moment the adviser stopped.
  const hearReply = useCallback(() => {
    if (!flash?.line) return;
    sayTurn([{ voice: VOICE, text: flash.line, agent: PITCHER_AGENT }]);
    setFlash((f) => (f ? { ...f, heard: true } : f));
  }, [flash, sayTurn]);

  const advance = useCallback(() => {
    // Voids any beat still owed — see replyFor. Without this a board stamped by
    // a press you walked out of lands on the NEXT claim.
    replyFor.current = null;
    setFlash(null);
    Object.values(screensRef.current).forEach((x) => x.stayBlack());
    onFocusAgent?.(PITCHER_AGENT);
    setRun((r) => doAdvance(r, deal));
  }, [deal, onFocusAgent]);

  const callIt = useCallback(() => {
    replyFor.current = null;
    setFlash(null);
    setRun((r) => doCallIt(r, deal));
  }, [deal]);

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
  const virgil = useMemo(
    () => (claim ? virgilRead(claim, {
      owner: laneOwner(claim), spent: run.advisersSpent,
      remaining: outlook.remaining, tips,
    }) : null),
    [claim, run.advisersSpent, outlook.remaining, tips]);
  const readout = useMemo(() => callReadout(slider), [slider]);
  const read = useMemo(() => coverageScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;
  // Both derived from pressUi/pressRun rather than restated here — restating
  // them per surface is exactly how the two presentations drifted apart.
  const live = pressIsLegal(run, claim);
  const lastClaim = run.claimIndex >= deal.claims.length - 1;

  /* ------------------------------------------------------------------ */
  return (
    <div className="ps-root">
      <style>{CSS}</style>

      {/* ---------- top bar: always visible, never blocks the room ---------- */}
      <div className="ps-bar">
        <button className="ps-exit" onClick={onExit}>◀ LEAVE THE DESK</button>
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
        <div className="ps-book">
          BOOK <b>{Math.round(run.book)}</b>
        </div>
      </div>

      {/* ---------- the opening: the room, then the deal ---------- */}
      {!started && (
        <div className={`ps-open${rolled ? " is-rolled" : ""}${rolling ? " is-rolling" : ""}`}>
          {/* The roll and the deal sheet fill the left. Copy right, with the
              four portraits beneath it. Nothing in this panel is clickable except
              the one CTA — it is a briefing, not a board. */}

          {/* Mid-arrival, a click anywhere completes it. This has to be a real
              <button> to be clickable at all: .ps-root is pointer-events:none
              and hands input only to buttons and inputs. */}
          {rolling && (
            <button className="ps-skip-deal" onClick={skipRoll} aria-label="Show them in now" />
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

          {/* BAND 0 — THE STATUS RAIL. Inside the panel rather than up on .ps-bar:
              the rail reports the state of THIS INTAKE (mandate, access, mode) and
              the bar reports the session (leave, book). On the phone the two are
              stacked instruments; here the panel is the instrument, so the rail is
              its top edge. It leaves with the briefing, as it does on the phone. */}
          <div className="ps-market-rail" aria-label="Deal simulation status">
            {/* —— at rest, not PENDING — same fix as the flat surface: the rail
                cell is a blank field the settle fills, and PENDING was a second
                "not yet" the one-signal count couldn't carry. */}
            <span><i>MANDATE</i>{identity ? deal.ticker : "——"}</span>
            <span><i>ACCESS</i>GUEST</span>
            <span><i>MODE</i>LIVE SIM</span>
          </div>

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
            <p>One pitch. Three interruptions. Then say how much of it you believe.</p>
          </div>

          {/* BAND 2 — THE RECORD, full panel width, inside its housing, inside
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
              ref={recordRef} clientRef={clientRef}
              particularsRef={particularsRef}
              stampRetainedRef={stampRetainedRef}
              coverRef={coverRef} />
          </div>

          {/* BAND 3 — WHAT IS ABOUT TO HAPPEN, AS THREE NUMBERS.
              This replaced ~90 words in two columns (.ps-open-copy's "A pitch bot
              is here to present its client's deal…" and .ps-open-aside's HOW YOUR
              ANALYSTS WORK). Those columns existed because the panel's full width
              ran ~97ch of monospace per line and a single column of that much prose
              was unreadable — but the fix for too much prose on a briefing is less
              prose, not a second measure to put it in. The shape of the session is
              three counts; only the INCENTIVE needed a sentence, and it gets one.

              The eyebrow the copy column carried (YOUR NEXT APPOINTMENT) moved up
              to the head, where it is CH 02 // INCOMING MANDATE. */}
          <div className="ps-protocol" aria-label="Meeting protocol">
            <div><b>03</b><span>INTERRUPTS</span></div>
            <div><b>04</b><span>ANALYSTS</span></div>
            <div><b>01</b><span>FINAL CALL</span></div>
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
            Every fact the pitch bot states is true...technically. But is the project viable? Consult with the team and decide whether it deserves funding.
          </p>

          {/* BAND 4 — THE DESK. Portraits, not card faces — a card is a thing you
              look at, and four in a row read as a cast list even when they were the
              controls (see the note on SeatRow in pressUi.jsx). Nothing here is
              clickable: on the briefing they are an introduction, and the sendable
              version of the same four is the seat row on the floor.

              "THE DESK — always these four, and the cat" until 2026-07-29 (author:
              didn't like it). "always these four" was reassurance about a rotating
              cast, and the rotating cast was cut in [A§17] — so it answered a
              question no player can now think to ask, in the defensive register of
              a changelog. The possessive is the load-bearing half: they are the
              player's, one use each. The cat needs no mention in the label; he has
              a divider and a NOT A SEAT line of his own.

              ANALYSTS, NOT AGENTS. "The Trade Agents" was the other candidate and
              it was rejected on the same day the PITCHER stopped being called "The
              Agent": one word for both sides of the table is the cast-legibility
              failure this file keeps logging (see the borrowed-portrait note in
              desk.js, and [A§12] on four cards reading as a cast list). ANALYST is
              also what §1 has called them all along. Internals keep DESK/DESK_ORDER;
              only the label is player-facing.

              THE LABEL IS A RULED SECTION LINE NOW, not a centred caption over the
              row, and the right half of it is where the scarcity rule went when the
              prose columns were cut: ONE ANSWER EACH. The rule reads better as a
              property of the band than as a paragraph two bands above it. */}
          <div className="ps-section-line">
            <span>YOUR ANALYST TEAM</span>
            <i>ONE ANSWER EACH</i>
          </div>
          <div className="ps-tools">
              <div className="ps-draw-row">
                {DESK_ORDER.map((m) => (
                  <div key={m.id} className="ps-face" title={m.blurb}>
                    <img className="ps-face-pic" src={m.portrait} alt="" aria-hidden="true" />
                    <span className="ps-face-who">{m.name}</span>
                    <span className="ps-face-role">{m.role}</span>
                  </div>
                ))}
                {/* VIRGIL, AT THE END OF THE ROW AND BEHIND A DIVIDER.
                    He was here once and it failed: a cat's face above the
                    pitching CTA read as the CAT doing the pitching (author,
                    2026-07-28), which is why he was moved into the hero
                    column. Moving him back is safe now for a reason that
                    didn't exist then — THE PITCHER IS NO LONGER ONE OF THESE
                    FACES. It's an outside agent, named in the copy above, so
                    a fifth portrait can't be mistaken for the one selling.

                    The divider and the NOT A SEAT line are load-bearing, not
                    decoration: they are what keeps him legible as a companion
                    rather than a spendable. If he ever reads as pitching
                    again, he goes back to his own block. */}
                <span className="ps-face-div" aria-hidden="true" />
                <div className="ps-face ps-face-cat" title={VIRGIL.blurb}>
                  <img className="ps-face-pic" src={VIRGIL.portrait} alt="" aria-hidden="true" />
                  <span className="ps-face-who">{VIRGIL.name}</span>
                  <span className="ps-face-role">{VIRGIL.role}</span>
                  <span className="ps-face-note">NOT A SEAT</span>
                </div>
              </div>
          </div>

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

      {/* ---------- the opening ----------
          Same container as the reading column, so the block does not move when
          the first claim replaces it: only the content inside changes. */}
      {onFloor && !opened && (
        <div className="ps-readcol">
          <div className="ps-fade in">
            <OpeningBody lines={openingLines} at={openingAt} onSkip={skipOpening} />
          </div>
        </div>
      )}

      {/* ---------- the floor ---------- */}
      {floorLive && claim && (
        <>
          {/* Claim and answer share ONE flow column, so a long answer pushes
              the claim up instead of covering it. Both bodies come from
              pressUi — this file owns only WHERE the column sits. */}
          <div className="ps-readcol">
            <div className={`ps-fade ${claimVisible ? "in" : ""}`}>
              <ClaimBody claim={claim} virgil={virgil} onToggleTips={() => setTips((t) => !t)}
                       pressure={mood} aside={aside}
                         spent={run.advisersSpent} />
            </div>
            {flash && flash.id === claim.id && (
              <AnswerBody flash={flash}>
                <AnswerChoice flash={flash} onLook={lookAtBoard} onHear={hearReply} />
              </AnswerBody>
            )}

            {/* ON THE RECORD. Claim six is a decision about claims one to five,
                and until now the only way to hold them was to remember them —
                the controller has been recording every one in `run.chips` since
                the first slice and neither surface ever showed it.
                Collapsible, and it scrolls inside itself so it can't push the
                claim body around. */}
            <Transcript run={run} deal={deal} open={script}
                        onToggle={() => setScript((v) => !v)} />
          </div>

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
          <input
            className="ps-slider"
            type="range" min={-100} max={100} step={5}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
          />
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
          <div className="ps-slider-ends"><span>FUD</span><span>PASS</span><span>FUND</span></div>
          <div className="ps-saying">{readout.saying}</div>
          <div className="ps-risk">{readout.risk}</div>
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
          <div className={`ps-lower-pnl ${run.call.pnl >= 0 ? "up" : "down"}`}>
            {run.call.pnl >= 0 ? "+" : ""}{Math.round(run.call.pnl)}
          </div>
          <div className="ps-lower-body">
            <div className="ps-lower-h">{run.call.pnl >= 0 ? "YOU READ IT RIGHT" : "YOU GOT IT WRONG"}</div>
            <div className="ps-lower-truth">{deal.resolution}</div>
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
          <button className="ps-lock" onClick={onExit}>LEAVE THE DESK</button>
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
.ps-exit { background:none; border:1px solid rgba(47,214,214,0.45); color:#2fd6d6;
  font-size:11px; letter-spacing:0.08em; padding:6px 10px; cursor:pointer; }
.ps-deal { font-weight:bold; letter-spacing:0.1em; }
.ps-book b { color:#ffd23a; font-size:15px; margin-left:6px; }

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
.ps-readcol { position:absolute; left:18px; bottom:calc(var(--nav-clear) + 12px);
  width:min(430px, 38vw);
  max-height:calc(100vh - var(--nav-clear) - 96px); overflow-y:auto;
  display:flex; flex-direction:column; gap:8px; }
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

/* BAND 0 — THE STATUS RAIL. Three cells, bevelled at opposite corners, in the
   same register as the rest of the terminal's readouts. MANDATE gets the widest
   cell because it is the only one whose value changes (—— at rest → the ticker
   at the settle). */
.ps-market-rail {
  display:grid; grid-template-columns:1.1fr .85fr 1fr;
  border:1px solid rgba(47,214,214,.18); background:rgba(2,18,17,.72);
  clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));
}
.ps-market-rail span {
  min-width:0; padding:9px 13px; color:#b9d8d3;
  font-size:10.5px; letter-spacing:.1em; white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis;
}
.ps-market-rail span + span { border-left:1px solid rgba(47,214,214,.12); }
.ps-market-rail i {
  display:block; margin-bottom:3px; color:rgba(47,214,214,.5);
  font-style:normal; font-size:8.5px; letter-spacing:.17em;
}
.ps-market-rail span:first-child { color:#ffd23a; }

/* BAND 1 — THE HEAD. The one display face on the panel other than the record's
   letterhead, and it is Orbitron rather than Bebas because this is the terminal
   speaking, not the paperwork. Two lines, the second in gold: the instruction
   splits into what you do and what you do it for, and colouring the second half
   is what keeps a 34px headline from reading as a single shout. */
.ps-start-head { margin:12px 0 0; }
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

/* BAND 2 — THE HOUSING. See the render site for why the record now sits in one.
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

/* BAND 3 — THE PROTOCOL. Three counts, baseline-aligned so the numerals read as
   a row of values rather than three stacked captions. */
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
.ps-directive { margin:11px 2px 0; max-width:78ch; color:#b7d5cf; font-size:13px; line-height:1.5; }

/* BAND 4's label — a ruled line with the rule on the right, which is what the
   band's old centred caption became. The border-top is the band separator the
   deleted .ps-tools rule used to carry. */
.ps-section-line {
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  margin-top:15px; padding-top:11px; border-top:1px solid rgba(47,214,214,.16);
  color:#2fd6d6; font-size:11px; letter-spacing:.16em;
}
.ps-section-line i {
  color:rgba(255,210,58,.58); font-style:normal; font-size:9px; letter-spacing:.13em;
}

/* THE DESK, FULL PANEL WIDTH. Inside the deleted copy column it was 460px of a
   756px panel, which left the five portraits crowded on the right while the space
   under the record sat empty; out here a cast list gets the wide row it wants.
   CENTRED, AND BIGGER (author: "maybe the analyst images could be larger and/or
   centered") — both, and they need each other: 52px portraits left-aligned read
   as a footnote to the copy above them, and this band is not a footnote. It is
   the interface for the next four minutes. */
.ps-tools { margin-top:10px; }
.ps-draw-row { display:flex; gap:9px; flex-wrap:wrap; justify-content:center; }

/* THE DESK, as people rather than card faces. Not buttons: on the briefing
   these introduce the four, and the sendable version is SeatRow on the floor.
   Fixed width so four tiles hold one row and the names can't ragged-wrap. */
.ps-face { flex:none; width:94px; display:flex; flex-direction:column;
  align-items:center; gap:4px; text-align:center; }
.ps-face-pic { width:66px; height:66px; object-fit:cover; border-radius:50%;
  border:1px solid rgba(47,214,214,0.35); background:#020f0d; }
/* Two lines reserved for every name — "Detective Marisol" wraps and the other
   three don't, which put her role label a line below everyone else's. */
.ps-face-who { font-size:9px; font-weight:bold; letter-spacing:0.04em;
  color:rgba(234,255,249,0.92); line-height:1.2; min-height:2.4em;
  display:flex; align-items:center; justify-content:center; }
/* THE LANE IS THE POINT — readable at rest, hover zoom as a reading aid; see
   the note on .pf-face-role, which this mirrors band for band. */
.ps-face-role { font-size:9.5px; letter-spacing:0.11em; color:#ffd23a; }
@media (hover:hover) {
  .ps-face-pic { transition:transform .18s ease; }
  .ps-face:hover .ps-face-pic { transform:scale(1.22); }
  .ps-face:hover .ps-face-role { color:#ffe27a; }
}

/* VIRGIL, at the end of the desk row and set apart from it on purpose — not a
   seat, no lane, cannot be sent. The divider is what carries that, so it is not
   a decoration to tidy away. */
.ps-face-div { flex:none; align-self:center; width:1px; height:44px;
  background:rgba(234,255,249,0.16); margin:0 3px; }
.ps-face-cat .ps-face-pic { border-color:rgba(191,238,222,0.5); }
.ps-face-cat .ps-face-who { color:#bfeede; }
.ps-face-cat .ps-face-role { color:rgba(191,238,222,0.75); }
.ps-face-note { font-size:7.5px; letter-spacing:0.12em;
  color:rgba(191,238,222,0.5); margin-top:1px; }

/* THE ARRIVAL — record styles come from engagement.jsx's ENGAGEMENT_CSS,
   prepended to this sheet. What's local to this surface is the skip target. */
.ps-skip-deal { position:absolute; inset:0; z-index:5; background:none; border:none;
  padding:0; cursor:pointer; }
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
.ps-lower-go { flex:none; background:none; border:1px solid #ffd23a; color:#ffd23a;
  font-size:11.5px; letter-spacing:0.1em; padding:12px 18px; cursor:pointer; }
.ps-lower-go:hover { background:rgba(255,210,58,0.12); }
.ps-panel-h { font-size:12px; letter-spacing:0.16em; color:#2fd6d6; font-weight:bold; margin-bottom:16px; }
.ps-slider { width:100%; accent-color:#ff2d6f; }
.ps-slider-ends { display:flex; justify-content:space-between; font-size:10px;
  letter-spacing:0.12em; color:rgba(234,255,249,0.5); margin-top:4px; }
.ps-saying { font-size:16px; margin-top:18px; }
.ps-risk { font-size:12.5px; color:#ffd23a; margin-top:8px; }
.ps-lock { margin-top:4px; width:100%; background:none; border:1px solid #ffd23a;
  color:#ffd23a; font-size:13px; letter-spacing:0.12em; padding:13px; cursor:pointer; }
.ps-pnl { font-size:44px; font-weight:bold; letter-spacing:0.04em; }
.ps-pnl.up { color:#4dffaa; } .ps-pnl.down { color:#ff5f6f; }
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
  .ps-market-rail span { padding:5px 13px; }
  .ps-start-head { margin-top:7px; }
  .ps-start-head h1 { margin:5px 0 5px; font-size:25px; }
  .ps-start-head p { font-size:12px; }
  .ps-record-shell { margin-top:9px; padding:28px 9px 8px; }
  .ps-open .eng-frame { width:62px; }
  .ps-protocol { margin-top:9px; }
  .ps-protocol div { padding:8px 14px 7px; }
  .ps-protocol b { font-size:17px; }
  .ps-directive { margin-top:9px; font-size:12px; }
  .ps-section-line { margin-top:9px; padding-top:9px; }
  .ps-face-pic { width:48px; height:48px; }
  /* Only the top margin moves — the -18px bottom is the sticky flush offset and
     tracks .ps-open's padding, not the band rhythm. */
  .ps-cta-row { margin-top:10px; padding-top:9px; }
  .ps-cta-row .ps-lock { font-size:15px; padding:11px 13px; }
}

@media (max-width: 860px) {
  /* The reading column and the dock stop competing for the width and stack. */
  .ps-readcol { width:calc(100% - 36px); right:18px; max-height:38vh; }
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
