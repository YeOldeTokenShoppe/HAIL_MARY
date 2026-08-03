"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, rollSeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, PITCHER, SEATS, SEAT_LANE, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, DESK_ORDER, PITCH_BOT, laneOwner, laneSentence, pitchOpening, pitcherAside, seatMeta } from "@/game/terminal-traders/press/desk";
import { pitcherVoice } from "@/game/terminal-traders/press/pitchers";
import { VIRGIL, virgilRead } from "@/game/terminal-traders/press/virgil";
import {
  PHASE, PRESSES,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt, seatOptions,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, coverageScore, laneOutlook, pressure,
} from "@/game/terminal-traders/press/pressRun";
import { speakAdviserLine, stopAdviserAudio, unlockAdviserAudio } from "@/lib/counselSpeech";
import PressFigure from "./PressFigure";
import { preloadSfx } from "@/lib/uiSfx";
import gsap from "gsap";
import {
  EngagementRecord, runArrival, endArrival, prefersReducedMotion, SFX,
  ENGAGEMENT_CSS, peekFileNo, commitFileNo,
} from "./engagement";
import { createFlatEvidenceScreen } from "./evidenceScreen";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, AnswerChoice, OpeningBody, SeatRow,
  Meter, Nav, readDwellMs, PRESS_UI_CSS,
} from "./pressUi";
import TerminalModuleHeader from "../TerminalModuleHeader";

// THE VC GAME — flat presentation. No WebGL, portrait-first.
//
// SAME RUN, DIFFERENT VIEW. Every rule lives in pressRun.js, which is pure and
// renders nothing; this file and PressSession.jsx are two presentations of it.
// Nothing here may contain a rule — if you find yourself writing one, it goes
// in the controller so both surfaces get it and the harness pins it.
//
// This is the MOBILE view, rendered inside the CRT the laptop zoom opens, and
// it is also `?flat=1` on desktop — a permanent fallback, so a WebGL regression
// (the white-mass bug cost a rollback once already) can never take the game
// offline entirely.
//
// What it does that the 3D view can't: THE EVIDENCE SCREEN IS LITERALLY THE
// SCREEN. On desktop "its monitor stays black" is a texture across the room;
// here the panel IS a terminal, and the strip under it puts all four boards a
// tap apart.
//
// THE VOICE IS NO LONGER THIS SURFACE'S EXCLUSIVE. It used to be — "Barron
// SPEAKS, desktop is stuck with banked SitePal clips" stood here — and it
// stopped being true on 2026-07-29, when PressSession took the same
// /api/counsel-voice path this surface proved (see its own note: the pitcher is
// a glTF bot with a screen for a face, so SitePal was never the route for it).
// Both surfaces voice any generated line now. What differs is what the sound
// DRIVES: desktop has LED viseme plates inside the rig, and here the same
// amplitude runs the projection — see PressFigure.

// THE PITCHER'S VOICE, and the DEFAULT for anything sayTurn isn't given a voice
// for — the claim's spin, and the pitcher's reaction after a seat reports. Was
// "JB" while Connor did the selling; the pitch bot has its own ElevenLabs
// voice now (VOICES.PB / PB2 / PB3 in api/counsel-voice, overridable with
// ELEVENLABS_VOICE_PITCHBOT*).
//
// WHICH VOICE DEPENDS ON WHICH RIG IS STAGED, as of 2026-08-02. It was pinned to
// "PB" and had to be while `getPitchBotVoice` was the only answer, because that
// lives in lib/trade/pitchBotScene and importing it would drag three.js onto a
// surface with no WebGL at all. press/pitchers exists precisely to break that
// tie: it is three-free, it holds the SAME roll desktop reads, and it answers
// the same question. A pinned code here put the second and third bots' faces —
// on the record, on the seat tile, on the feed — over the first bot's throat.
//
// MODULE SCOPE IS DELIBERATE AND SAFE, same as PressSession's copy: the rig is
// resolved once per page load and swapping one already requires a reload, so
// this has exactly the lifetime of the thing it names. Under SSR there is no
// `window`, the resolver returns the fallback without rolling, and the browser
// copy of the module — the only one that ever plays audio — resolves properly.
//
// The adviser half is NO LONGER silent: `sayTurn` voices the seat first in its
// own key, then the pitcher — see the TWO VOICES PER PRESS note below.
const VOICE = pitcherVoice();

export default function PressFlat({ deal: dealOverride = null, onExit }) {
  // A FRESH DEAL EVERY TIME YOU SIT DOWN — see the note in instanceDeal.js for
  // why the daily was built and cut. State, not a memo dependency, so the seed
  // is stable for the session instead of rerolling on every render.
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
  const [flash, setFlash] = useState(null);
  const [started, setStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /* WHOSE VOICE IS IN FLIGHT. "Somebody is talking" and "WHO is talking" are
     different questions, and the feed needs the second one: it reads its
     amplitude out of adviserMouth BY KEY, so a panel told the wrong speaker
     shows a face that never moves — no error, no warning, just a still.
     A press puts an ADVISER on the audio for a beat (see TWO VOICES PER PRESS),
     so under a bare `speaking` the panel lit its ON AIR lamp and ran a dead
     level meter every time a seat reported, under the pitcher's face. */
  const [speakingAs, setSpeakingAs] = useState(null);
  /* WHO THE FEED IS POINTED AT. Desktop cuts the camera to whoever is talking
     (PressSession's "THE CAMERA FOLLOWS THE VOICE, NOT THE PRESS"); this surface
     had one fixed shot of the pitcher, so an adviser you had just spent went and
     looked, reported, and never appeared. It follows the voice for the same
     reason desktop does, and it HOLDS on the reporter afterwards rather than
     snapping back — their finding is what you are reading at that moment. Back
     to the pitcher when the next claim starts. */
  const [onCamera, setOnCamera] = useState(PITCHER);
  // FEED | SCREEN. Not just a space-saver on a phone: a press CUTS to his
  // screen, so "nothing landed" is something you went and looked at rather
  // than something you passively failed to notice.
  const [pane, setPane] = useState("feed");
  // Mirrored into state because the tab label reads it during render — a ref
  // would never re-render and the badge would stay stale after a press.
  const [hasRecord, setHasRecord] = useState(false);
  const [boardPane, setBoardPane] = useState(PITCHER);
  // He's answered and the board has changed, and you HAVEN'T LOOKED YET.
  // Until you do, nothing on this surface may name the outcome — see the tab
  // badge and .pf-answer below.
  const [lookPending, setLookPending] = useState(false);
  const screenRef = useRef(null);
  const readRef = useRef(null);
  // The deferred reveal fires from a closure that would otherwise capture a
  // stale `pane`, and it has to know whether you're already looking.
  const paneRef = useRef("feed");
  useEffect(() => { paneRef.current = pane; }, [pane]);

  /* ---- the arrival ----
     Same choreography as the 3D view (./arrival), with one thing this surface
     has to solve that the desktop panel doesn't: the briefing is a SCROLLING
     column taller than a phone, so the plate and the desk strip are never on
     screen together. We pin the view to the top first — the agent arriving is
     what unseals the name, so that's the beat worth seeing — and then slide down
     to the desk once it's in the room. */
  const [rolled, setRolled] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [settled, setSettled] = useState(false);
  const identity = rolled || settled;
  // The desk's caseload, not a roll — peeked here, committed when the file is
  // opened. See peekFileNo in engagement.jsx. The ref is the once-per-sitting
  // commit guard: rolling/rolled are React state and can double-pass in one
  // event batch.
  const [fileNo] = useState(() => peekFileNo());
  const fileCommitted = useRef(false);
  const recordRef = useRef(null);
  const shieldRef = useRef(null);
  const clientRef = useRef(null);
  const termsRef = useRef(null);
  const stampRetainedRef = useRef(null);
  const particularsRef = useRef(null);
  const coverRef = useRef(null);
  const scrollRef = useRef(null);
  const tlRef = useRef(null);

  useEffect(() => { Object.values(SFX).forEach(preloadSfx); }, []);
  useEffect(() => () => endArrival(tlRef.current), []);

  // NO AUTO-SCROLL AFTER THE ROLL. There used to be one: the deal laid out five
  // cards and the three question cards landed below the fold, so the column slid
  // down to show you what you'd drawn. Cards went on 2026-07-28 and the strip
  // below is now the DESK — the same four people every session, i.e. nothing to
  // reveal. Keeping the scroll meant that the instant the deal was finally
  // named, the column scrolled away from the name and the sheet to show four
  // a plate that hadn't changed. The reveal is the payoff; stay on it.
  // The CTA is position:sticky, so nothing goes out of reach by not scrolling.

  const runRoll = useCallback(() => {
    if (rolling || rolled) return;
    // The file is being opened either way — the caseload counts it either way.
    if (!fileCommitted.current) { fileCommitted.current = true; commitFileNo(); }
    if (prefersReducedMotion()) { setSettled(true); setRolled(true); return; }

    // Pin to the top first — the record is up there, and an arrival you
    // scrolled past is a beat that may as well not have played.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    setRolling(true);
    const tl = runArrival({
      record: recordRef.current,
      shield: shieldRef.current,
      client: clientRef.current,
      clientText: deal.name,
      terms: termsRef.current,
      stampRetained: stampRetainedRef.current,
      particulars: particularsRef.current,
      cover: coverRef.current,
      onSettled: () => setSettled(true),
      onDone: () => { setRolling(false); setRolled(true); },
    });
    if (!tl) { setRolling(false); setSettled(true); setRolled(true); return; }
    tlRef.current = tl;
  }, [rolling, rolled]);

  const skipRoll = useCallback(() => {
    if (rolling) tlRef.current?.progress(1);
  }, [rolling]);

  const claim = currentClaim(run, deal);
  const onFloor = started && run.phase === PHASE.FLOOR;

  /* ---- the opening ----
     HEAR THE PITCH used to cut straight to claim 1, so the bot arrived already
     mid-argument (author, 2026-08-02). See PITCH_OPENING in desk.js.

     `onFloor` still gates the FIGURE — you want to watch it talk while it
     introduces itself — and `floorLive` gates everything that presupposes a
     claim: the claim body, the agenda, the dock. Same split as PressSession, and
     it has to stay the same split or the two surfaces drift on which beat owns
     the mouth. */
  const openingLines = useMemo(() => pitchOpening(deal), [deal]);
  const [openingAt, setOpeningAt] = useState(-1);
  const [opened, setOpened] = useState(false);
  const floorLive = onFloor && opened;

  // Who can be sent at the claim on the floor, and why not. Straight from the
  // controller so the button states can never disagree with the rules.
  const options = useMemo(() => seatOptions(run, deal), [run, deal]);
  // What's still coming in this lane — the one thing Eugene knows that no other
  // surface does, and the reason his read stopped being a restatement of the
  // lane band. Lanes only: it cannot leak the branch.
  const outlook = useMemo(() => laneOutlook(run, deal), [run, deal]);
  // How the pitch is going FOR HIM — a summary of outcomes you've already seen,
  // handed back as posture. The aside is held to the CLAIM so it can't change
  // mid-read; the mood band is live.
  const mood = useMemo(() => pressure(run), [run]);
  const aside = useMemo(
    () => pitcherAside(mood.band, claim, run.claimIndex),
    [mood.band, claim, run.claimIndex]);
  const readout = useMemo(() => callReadout(slider), [slider]);
  const read = useMemo(() => coverageScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;
  // A press is legal only while he's on a claim you haven't already answered
  // and you still have budget. The dock shows the press affordances ONLY then
  // — see the note on .pf-dock below for why that's structural, not cosmetic.
  // The predicate itself lives in pressUi so both surfaces gate identically;
  // this file having its own copy is how desktop ended up referencing a
  // `canPress` that was never declared there.
  const live = pressIsLegal(run, claim);
  const lastClaim = run.claimIndex >= deal.claims.length - 1;
  const advisersLeft = SPENDABLE_SEATS.filter((x) => !run.advisersSpent.includes(x)).length;
  // Eugene is free and automatic — he reads the shape of every claim and points
  // at whose lane it is. He never stamps a receipt, so he can never carry the
  // answer; he only tells you who COULD settle it. Reads the run as well as the
  // claim, so he stops naming an adviser you've already spent.
  // VIRGIL, not a seat. `tips` is the player's — the agenda half ignores it.
  const [tips, setTips] = useState(true);
  const virgil = useMemo(
    () => (claim ? virgilRead(claim, {
      owner: laneOwner(claim), spent: run.advisersSpent,
      remaining: outlook.remaining, tips,
    }) : null),
    [claim, run.advisersSpent, outlook.remaining, tips]);

  /* ---- the evidence screen, as an actual on-screen terminal ---- */
  // One board per seat that can be sent. Only one is on screen at a time; the
  // strip below is how you move between them.
  //
  // PITCHER, not Barron, holds the first tab. Barron ALIASES onto it (see the
  // same note in PressSession): the agent is an outsider whose receipt belongs
  // on the easel page once that is wired.
  //
  // EUGENE HAD NO BOARD HERE UNTIL 2026-08-02, on a "he never stamps anything,
  // by design" that stopped being true when he became a spendable seat with a
  // lane of his own. He produces receipts like any other specialist, and the
  // desktop surface has always given him a monitor — so pressing him on a phone
  // stamped into `undefined`, set boardPane to a seat with no panel, and printed
  // ON RECORD — ON EUGENE'S SCREEN over a screen that did not exist.
  //
  // It was invisible while every board rendered stacked (see .pf-screen): you
  // got somebody else's panel and no reason to doubt it. Fixing the stacking is
  // what surfaced this, and the two belong together.
  const BOARDS = useMemo(
    () => [PITCHER, SEATS.MARISOL, SEATS.GR80, SEATS.EUGENE], []);
  const screensRef = useRef({});
  useEffect(() => {
    if (!started) return;
    const made = {};
    for (const seat of BOARDS) {
      const el = document.getElementById(`pf-screen-${seat}`);
      if (!el) continue;
      made[seat] = createFlatEvidenceScreen(el, { header: seatMeta(seat).name.toUpperCase() });
    }
    screensRef.current = made;
    made[SEATS.BARRON] = made[PITCHER];   // alias — see BOARDS note
    screenRef.current = made[PITCHER] || null;
    return () => {
      Object.values(made).forEach((x) => x.dispose());
      screensRef.current = {}; screenRef.current = null;
    };
  }, [started, BOARDS]);

  /* ---- he says it out loud ----
     Token-guarded. A press interrupts the claim he's mid-way through, so two
     of these are briefly in flight: the one being cut off resolves through
     stopAdviserAudio and would otherwise land its finally AFTER the answer
     started, clearing `speaking` and freezing the mouth for the whole reply.
     Only the newest utterance may say he's stopped. */
  const sayToken = useRef(0);
  const say = useCallback(async (text) => {
    if (!text) return;
    const token = ++sayToken.current;
    setSpeakingAs(VOICE);
    setOnCamera(PITCHER);
    setSpeaking(true);
    try { await speakAdviserLine(VOICE, text); }
    catch { /* voice is enrichment, never a gate on play */ }
    finally { if (sayToken.current === token) setSpeaking(false); }
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
   * @param opts.onPart  index of each part AS IT STARTS — the opening reveals its
   *   lines in step with the voice rather than printing the block up front.
   * @param opts.dwell   (text) => ms floor per part, for the case where audio
   *   never arrives: speakAdviserLine resolves in milliseconds without an API
   *   key, and three un-held sentences are gone before they can be read. Voice is
   *   enrichment and never a gate, so anything timed off it needs a floor.
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
        setSpeakingAs(p.voice || VOICE);
        // `seat` is optional and defaults to the pitcher, so the opening and the
        // claim spins need no change — only a press names somebody else.
        setOnCamera(p.seat || PITCHER);
        const startedAt = Date.now();
        try { await speakAdviserLine(p.voice || VOICE, p.text); }
        catch { /* voice is enrichment, never a gate on play */ }
        if (dwell) {
          const left = dwell(p.text) - (Date.now() - startedAt);
          if (left > 0) await new Promise((r) => setTimeout(r, left));
        }
      }
    } finally {
      if (sayToken.current === token) setSpeaking(false);
    }
  }, []);

  /* ---- it introduces itself ----
     No audio-stopping cleanup, deliberately: a natural finish leaves nothing
     playing, and the two early exits (SKIP, unmount) are handled by skipOpening
     and by the unmount effect below. One here would race the claim effect, which
     starts speaking in the same commit that `opened` flips. */
  useEffect(() => {
    if (!onFloor || opened || !openingLines.length) return;
    let alive = true;
    (async () => {
      await sayTurn(openingLines.map((text) => ({ voice: VOICE, text })),
                    { onPart: (i) => { if (alive) setOpeningAt(i); }, dwell: readDwellMs });
      if (alive) setOpened(true);
    })();
    return () => { alive = false; };
  }, [onFloor, opened, openingLines, sayTurn]);

  // Bumping the token supersedes the chain in flight; its `finally` then declines
  // to touch `speaking`, so this clears it by hand.
  const skipOpening = useCallback(() => {
    sayToken.current++;
    try { stopAdviserAudio(); } catch {}
    setSpeaking(false);
    setOpened(true);
  }, []);

  // `floorLive`, not `onFloor`: during the opening the pitcher already has the
  // mouth, and starting claim 1 underneath it would put two of ITS OWN utterances
  // in flight — the collision sayToken arbitrates, except here both are valid.
  useEffect(() => {
    if (!floorLive || !claim) return;
    say(claim.spin);
    return () => { try { stopAdviserAudio(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorLive, run.claimIndex]);

  useEffect(() => () => { try { stopAdviserAudio(); } catch {} }, []);

  /* ---- the reading column follows the beat ----
     His answer renders BELOW the claim, so on a short screen it lands out of
     view in the one moment it's the whole point. Bring it up when it arrives,
     again when the LOOK directive replaces the note under it, and go back to
     the top when he starts the next claim. */
  useEffect(() => {
    if (!flash) return;
    const el = readRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() =>
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [flash, lookPending]);

  useEffect(() => { readRef.current?.scrollTo({ top: 0 }); }, [run.claimIndex]);

  // Mark the column while there's more of him below the fold. Without it a
  // claim that overflows just looks truncated — the text stops mid-sentence at
  // a hard edge and reads as the layout bug this file just stopped having.
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = readRef.current;
    if (!el) return;
    const sync = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", sync); ro.disconnect(); };
  }, [onFloor, run.claimIndex, flash]);

  /* ---- actions ---- */
  // The cut to his screen is DEFERRED until he stops talking. Holds the claim
  // it's owed to, so a cut can never land on a claim you've already left.
  const revealFor = useRef(null);
  const MIN_BEAT = 1400;  // if his voice is unavailable, the beat still exists

  const press = useCallback((seat = PITCHER) => {
    if (!floorLive) return;   // nothing to interrupt until it has made a claim
    const next = doPress(run, deal, seat);
    if (next === run) return;   // illegal, spent, or out of budget — a no-op
    const outcome = next.outcomes[claim.id];
    setRun(next);
    // `stage: "reporting"` — the verdict copy and the panel's colour are both
    // derived from data we have RIGHT NOW, so without this the answer interprets
    // itself the instant you press, describing a board that hasn't changed yet.
    // Subtitling the reply is fine; interpreting it before it is given is not.
    //
    // A press on the PITCHER has no third party to react, so its answer IS the
    // exchange: nothing to choose between, and it plays on the spot.
    const solo = !outcome.adviserSays;
    setFlash({
      id: claim.id, backing: outcome.backing,
      seat: outcome.seat, board: outcome.board,
      nothingOnFile: outcome.nothingOnFile,
      adviserSays: outcome.adviserSays,
      line: outcome.barronSays,
      stage: "reporting",
      heard: solo,
      looked: false,
      asked: outcome.seat === PITCHER
        ? "Put a number on it."
        : `${seatMeta(outcome.seat).name} — ${seatMeta(outcome.seat).role}`,
    });

    // You INTERRUPTED him — so he stops the sentence he was on and answers.
    // Without this the claim line and the reply play over each other.
    try { stopAdviserAudio(); } catch {}

    // HE KEEPS THE FRAME WHILE HE ANSWERS, THEN YOU GO AND LOOK.
    //
    // Two earlier shapes were both wrong. Cutting on the press put the board
    // up at the exact moment he started talking — you heard the reply over a
    // panel that hadn't changed yet and never watched him deliver it. Cutting
    // when he FINISHED fixed the timing but still did the looking for you,
    // and the whole point of the beat (VC_GAME.md §2) is that the absence is
    // something you went and looked at rather than something you were shown.
    //
    // So: the board updates silently when he stops, the tab pulses, and the
    // answer panel points at it. Until you actually go, NOTHING names the
    // outcome — not the badge, not the panel's colour. Pressing on without
    // looking is allowed; it's the same forfeiting choice as not pressing.
    const owed = claim.id;
    revealFor.current = owed;
    Promise.all([
      // ONE VOICE. The seat reports; the pitcher's reaction used to follow in this
      // same chain and now waits behind a button — see AnswerChoice in pressUi.
      // `seat` puts the reporter ON CAMERA for the length of their line. It is
      // the only thing that names anyone but the pitcher, which is why the shot
      // needs no reset logic anywhere else.
      sayTurn([solo
        ? { voice: VOICE, text: outcome.barronSays, seat: PITCHER }
        : { voice: seatMeta(outcome.seat)?.voice, text: outcome.adviserSays,
            seat: outcome.seat }]),
      new Promise((r) => setTimeout(r, MIN_BEAT)),
    ])
      .then(() => {
        if (revealFor.current !== owed) return;   // you moved on; the beat is void
        revealFor.current = null;
        // The answer lands on whoever went and got it. An adviser who found
        // nothing stamps NOTHING ON FILE — an absence somebody independently
        // looked for, which is a different and stronger thing than Barron's
        // board simply staying dark.
        const board = screensRef.current[outcome.board];
        if (outcome.receipt) board?.stamp(outcome.receipt);
        else if (outcome.nothingOnFile) board?.stampNothing(claim.subject);
        else board?.stayBlack();
        setBoardPane(outcome.board);
        setHasRecord(!!outcome.receipt);
        setFlash((f) => (f && f.id === owed ? { ...f, stage: "choice" } : f));
        // Already sitting on the screen? Then you watched it land and there's
        // nothing to send you anywhere.
        setLookPending(paneRef.current !== "screen");
      });
  }, [run, deal, claim, floorLive, say]);

  // The one door to the screen — going there is what marks the outcome seen, and
  // `looked` is the gate on the verdict note and the panel's colour.
  const lookAtScreen = useCallback(() => {
    setPane("screen");
    setLookPending(false);
    setFlash((f) => (f ? { ...f, looked: true } : f));
  }, []);

  // LET IT ANSWER. Its own voice, on your say-so — the handover that used to
  // happen by itself the moment the adviser stopped.
  const hearReply = useCallback(() => {
    if (!flash?.line) return;
    sayTurn([{ voice: VOICE, text: flash.line }]);
    setFlash((f) => (f ? { ...f, heard: true } : f));
  }, [flash, sayTurn]);

  const advance = useCallback(() => {
    revealFor.current = null;
    setFlash(null);
    setPane("feed");     // new claim, back to its face
    setOnCamera(PITCHER);  // ...and off the analyst who reported on the last one
    setBoardPane(PITCHER);
    Object.values(screensRef.current).forEach((x) => x.stayBlack());
    setHasRecord(false);
    setLookPending(false);
    setRun((r) => doAdvance(r, deal));
  }, [deal]);
  const callIt = useCallback(() => {
    revealFor.current = null;
    setFlash(null);
    setLookPending(false);
    setRun((r) => doCallIt(r, deal));
  }, [deal]);
  const lockCall = useCallback(() => setRun((r) => doAllocate(r, deal, slider)), [deal, slider]);
  const finish = useCallback(() => setRun((r) => toAutopsy(r)), []);

  // The start tap is the ONLY user gesture we're guaranteed, so it unlocks the
  // audio context here (iOS will not play a decoded buffer without one). Fails
  // soft — no audio still leaves a playable game.
  //
  // IT USED TO REQUEST DEVICE-ORIENTATION TOO, and that is worth remembering
  // rather than just deleting: the gyro drove TradingCard's holofoil, then the
  // dice tray, and each time its consumer was cut the permission prompt outlived
  // it — an iOS system dialog for a feature that no longer existed, twice. When
  // you remove a visual, grep for what asked the OS for permission to drive it.
  const begin = useCallback(() => {
    try { unlockAdviserAudio(); } catch {}
    setStarted(true);
  }, []);

  /* ------------------------------------------------------------------ */
  return (
    <div className={`pf-wrap${started ? " is-started" : ""}`}>
      <style>{CSS}</style>

      <TerminalModuleHeader
        channel="PITCH BOT"
        mode="DEAL SIM"
        code={`BOOK ${Math.round(run.book)}`}
        accent="#ffd23a"
        active
        onBack={onExit}
      />

      {!started && (
        <div className="pf-market-rail" aria-label="Deal simulation status">
          {/* —— at rest, not PENDING: the rail cell is a blank field the settle
              fills, same idiom as the record's own —— rows. PENDING was status
              vocabulary — a fifth "not yet" the one-signal count (see the deal
              file in engagement.jsx) couldn't carry. */}
          <span><i>MANDATE</i>{identity ? deal.ticker : "——"}</span>
          <span><i>ACCESS</i>GUEST</span>
          <span><i>MODE</i>LIVE SIM</span>
        </div>
      )}

      {/* ---------- the briefing ----------
          NOTHING HERE MAY NAME THE DEAL BEFORE THE DICE STOP (invariant 7).
          Printing the deal's name and stats, and "Connor brought this one
          in", over an empty table announced both before either had been picked
          — exactly the reveal this beat exists to stage.

          onClick={skipRoll}: a tap anywhere mid-arrival completes it —
          impatience is a legitimate input. No overlay needed on this surface,
          unlike the 3D view's pointer-events:none root; the handler sits on
          the column and no-ops once the roll is done. */}
      {!started && (
        <div className={`pf-scroll pf-start${rolled ? " is-rolled" : ""}`} ref={scrollRef}
             onClick={skipRoll}>
          {/* See the note on this line in PressSession — the top bar already
              says "one deal", and "on the table" is left over from the cards. */}
          <div className="pf-start-head">
            <div className="pf-eyebrow">CH 02 // INCOMING MANDATE</div>
            <h1>READ THE DEAL.<br /><span>CALL THE BLUFF.</span></h1>
            <p>One pitch. Three interruptions. Decide whether it deserves your book.</p>
          </div>
          {/* THE PANEL NO LONGER NAMES THE DEAL HERE. A 20px headline, a subtitle
              restating the ticker, and the sheet below all printed the same
              instance — and the headline was the thing that animated, which put
              the ceremony on the prose and left the object watching. The reveal is
              the record's CLIENT line now. The block glyphs went with it: they
              were one of five things on this screen saying "not yet". */}

          {/* THE RECORD, INSIDE ITS DEAL FILE. Picked fresh for this sitting;
              you can't ask for a different one without leaving and coming back.
              See engagement.jsx for the five props that held this slot before
              it, and why the sixth is paperwork rather than another machine.

              THE SEALED OVERLAY IS GONE (2026-08-03) and the folder cover is
              what replaced it — closed geometry instead of CLIENT // SEALED
              captions, so the blank form beneath is mounted, visible-shaped, and
              covering its own rest state again ([A§20]'s "the empty-box problem
              was never a staging problem"). The readout went with it: its
              ○ AWAITING REVIEW doubled the record's pill 20px apart, and its
              DEAL INTAKE label was retired — the cover's letterhead names the
              document instead, PROSPECTUS (author's word). The shell is
              the housing, the cover is the file, and the record's own pill is
              the one place this surface says "not yet". */}
          <div className="pf-record-shell">
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
              ref={recordRef} shieldRef={shieldRef} clientRef={clientRef}
              termsRef={termsRef} particularsRef={particularsRef}
              stampRetainedRef={stampRetainedRef}
              coverRef={coverRef} />
          </div>
          {/* THE CAPTION IS GONE (author, 2026-07-29: "this line seems
              unnecessary"). It read SENT DOWN TO YOU · YOU DON'T GET TO ASK WHY
              THIS ONE, and it was load-bearing exactly once — against the dice,
              where it was the one thing a randomiser could never say for itself:
              who chose. A form that arrives ALREADY SIGNED does not raise the
              question, so the answer stopped being needed. What was left was the
              interface rebutting a complaint no player had made — the same
              failure as the three elements that used to narrate the client's
              absence. Both cuts are [A§20]. */}


          {/* The pitcher is an outside contractor on commission. This said "John
              Barron brought this one in — it's his deal" until 2026-07-29, when
              the bot took over the selling and Barron joined the desk; and then
              "an agent is here for a client who didn't come", cut the same day for
              pointing at the absence instead of the incentive (engagement.jsx). */}
          <div className="pf-protocol" aria-label="Meeting protocol">
            <div><b>03</b><span>INTERRUPTS</span></div>
            <div><b>04</b><span>ANALYSTS</span></div>
            <div><b>01</b><span>FINAL CALL</span></div>
          </div>
          <p className="pf-directive">
            The pitch bot is paid only if you fund the deal. Send one analyst
            per interruption; anything verifiable lands on-screen.
          </p>
          {/* Portraits, not card faces. Not buttons either: on the briefing
              these introduce the four, and the sendable version of the same
              row is SeatRow on the floor. */}
          {/* See PressSession — "always these four" answered a question the
              rotating-cast cut [A§17] deleted. */}
          <div className="pf-section-line">
            <span>YOUR ANALYST TEAM</span>
            <i>ONE ANSWER EACH</i>
          </div>
          <div className="pf-strip">
            {DESK_ORDER.map((m) => (
              <div key={m.id} className="pf-face">
                <img className="pf-face-pic" src={m.portrait} alt="" aria-hidden="true" />
                <span className="pf-face-who">{m.name}</span>
                <span className="pf-face-role">{m.role}</span>
              </div>
            ))}
            {/* VIRGIL, END OF THE ROW, BEHIND A DIVIDER. He was here once and it
                failed — a cat's face above the pitching CTA read as the CAT
                pitching (author, 2026-07-28). Safe now for a reason that didn't
                exist then: THE PITCHER IS NOT ONE OF THESE FACES any more. The
                divider and NOT A SEAT are what keep him legible as a companion;
                if he reads as pitching again he goes back to his own block. */}
            <span className="pf-face-div" aria-hidden="true" />
            <div className="pf-face pf-face-cat">
              <img className="pf-face-pic" src={VIRGIL.portrait} alt="" aria-hidden="true" />
              <span className="pf-face-who">{VIRGIL.name}</span>
              <span className="pf-face-role">{VIRGIL.role}</span>
              <span className="pf-face-note">NOT A SEAT</span>
            </div>
          </div>
          {/* ONE BUTTON — a LOCAL/DAILY split lived here briefly and was cut.
              See the note in instanceDeal.js. */}
          <div className="pf-cta-row">
            <button className="pf-btn primary" disabled={rolling}
                    onClick={rolled ? begin : runRoll}>
              {/* See the note on this line in PressSession — SEND IT IN was
                  strange wording ("it" named nothing), [A§11] and [A§20]. */}
              {rolled ? "HEAR THE PITCH ▸" : rolling ? "OPENING…" : "REVIEW THIS DEAL ▸"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- the floor ---------- */}
      {onFloor && claim && (
        <div className="pf-floor">
          <div className="pf-tabs">
            {/* NAMED FROM THE DESK, not typed in — and now named after WHOEVER
                THE FEED IS ON, which is the same fix twice over. It said BARRON,
                left over from when he did the selling, so the tab back to the
                PITCHER carried an ANALYST's name two rows above a seat row where
                that analyst is one of the four you can send. Hard-coding the
                pitcher instead would have reintroduced the same lie the moment
                the feed started cutting to the reporter. */}
            <button className={pane === "feed" ? "on" : ""} onClick={() => setPane("feed")}>
              ◉ {(seatMeta(onCamera)?.name || PITCH_BOT.name).toUpperCase()}
              {speaking && <em> · speaking</em>}
            </button>
            {/* THE BADGE MAY NOT ANSWER THE QUESTION THE BOARD IS THERE TO
                ANSWER. While the look is pending it says only that there IS
                something — "ON RECORD" here would hand you the outcome from
                the tab bar and make going to look pointless. */}
            <button className={`${pane === "screen" ? "on" : ""}${lookPending ? " look" : ""}`}
                    onClick={lookAtScreen}>
              {/* ITS, not HIS. The bot is an "it" in every other line of copy
                  the desk owns — "its client's deal", "ITS SCREEN STAYS BLACK",
                  "on its screen, and it stays there" — and this tab was the last
                  place still speaking about the pitcher as a man. */}
              ▤ ITS SCREEN
              <em className={lookPending ? "" : hasRecord ? "rec" : ""}>
                {lookPending ? " · LOOK" : hasRecord ? " · ON RECORD" : " · no record"}
              </em>
            </button>
          </div>
          <div className="pf-stage">
            <div className={`pf-pane ${pane === "feed" ? "show" : ""}`}>
              {/* `voice` AND `who` HAVE TO AGREE, and they come from the same
                  place for that reason: the panel reads its amplitude out of
                  adviserMouth BY KEY, so pointing the camera at Marisol while
                  passing the pitcher's code is not a mismatched label, it is a
                  face that never moves — no error, no warning. `speakingAs` is
                  set on the same part of the turn that sets `onCamera`.
                  `band` is the ONLY thing about how the pitch is going that may
                  reach the face — the same rule desktop's LED expressions are
                  under (VC_GAME.md §1 rule 3). */}
              <PressFigure speaking={speaking} voice={speakingAs || VOICE}
                           who={onCamera} band={mood.band} />
            </div>
            <div className={`pf-pane wide ${pane === "screen" ? "show" : ""}`}>
              {/* One board full-width — four canvases side by side on a phone
                  would render ~4.5px type, since evidenceScreen draws at fixed
                  offsets against 512x320. The strip underneath is the
                  comparison, in text, and it's how you reach the others. */}
              <div className="pf-boards">
                {BOARDS.map((seat) => (
                  <div key={seat} className={`pf-screen ${boardPane === seat ? "show" : ""}`}>
                    <canvas id={`pf-screen-${seat}`} width={512} height={320} />
                  </div>
                ))}
                <div className="pf-bstrip">
                  {BOARDS.map((seat) => {
                    const sc = screensRef.current[seat];
                    const state = sc?.hasReceipt?.() ? "rec" : sc?.hasSearched?.() ? "nil" : "";
                    return (
                      <button key={seat} className={`pf-bchip ${boardPane === seat ? "on" : ""} ${state}`}
                              onClick={() => setBoardPane(seat)}>
                        {seatMeta(seat)?.role}
                        <em>{state === "rec" ? "ON RECORD" : state === "nil" ? "NOTHING" : "—"}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* THE AGENDA. Every subject he'll cover, from second zero — without
              it, holding an adviser back is a blind bet and everyone spends on
              the first thing they see. Lane dots say who COULD settle each one;
              they never say whether it's worth settling. */}
          {/* THE AGENDA WAITS FOR THE FIRST CLAIM. It is a resource readout about
              claims — which are coming, which are settled — and there are none yet
              while the bot is still introducing itself. It also spoils the beat's
              one job: the opening says how many points there are, and printing all
              six subjects underneath answers that before it is asked. */}
          {floorLive && (
          <div className="pf-agenda">
            {deal.claims.map((c, i) => (
              <span key={c.id}
                    className={`pf-ag ${i < run.claimIndex ? "past" : ""} ${i === run.claimIndex ? "now" : ""} ${run.outcomes[c.id] ? "done" : ""}`}
                    data-lane={c.lane}>
                {c.subject}
              </span>
            ))}
          </div>
          )}

          {/* THE ONLY THING ON THE FLOOR THAT SCROLLS. Tabs, feed and dock are
              all pinned, so the way out of a claim is never further than a
              thumb. This region exists because it didn't: the floor was five
              flex:none rows in an overflow:hidden column, so on any viewport
              under ~900px tall the dock simply ran off the bottom and LET HIM
              GO ON / CALL IT were clipped away — measured at 839px in a 700px
              box. The pitch had no exit. */}
          <div className={`pf-read${more ? " more" : ""}`} ref={readRef}>
            {/* Opening, then claims. Same container either way — the block must
                not move when the first claim replaces the introduction. */}
            {opened ? (
              <ClaimBody claim={claim} virgil={virgil} onToggleTips={() => setTips((t) => !t)}
                         pressure={mood} aside={aside}
                         spent={run.advisersSpent}
                         count={`${run.claimIndex + 1} / ${deal.claims.length}`} />
            ) : (
              <OpeningBody lines={openingLines} at={openingAt} onSkip={skipOpening} />
            )}

            {flash && flash.id === claim.id && (
              /* The verdict — and the panel's COLOUR, which is a tell too — are
                 held back until he has finished, so every answer looks
                 identical while he's still talking. Once he stops, the LOOK
                 button takes the verdict's slot: the absence is something you
                 went and looked at, not something you were shown. */
              /* The LOOK button was the only thing in this slot; it is now one
                 of the two moves the beat offers, and both live in pressUi so the
                 surfaces cannot word them differently. */
              <AnswerBody flash={flash}>
                <AnswerChoice flash={flash} onLook={lookAtScreen} onHear={hearReply} />
              </AnswerBody>
            )}
          </div>{/* /pf-read */}

          {/* THE DOCK WAITS TOO. Every control in it presupposes a claim — the
              meter counts interruptions, the seat row spends an analyst ON
              something, and LET HIM GO ON has nothing to go on from. Offering
              them against an introduction is offering the player a way to waste a
              one-use analyst on a greeting. */}
          {floorLive && (
          <div className="pf-dock">
            <Meter run={run} presses={PRESSES}>
              <b>{advisersLeft} ADVISER{advisersLeft === 1 ? "" : "S"}</b>
            </Meter>

            {/* The seat row is here only while a press is LEGAL. Once you've
                had your answer they are dead controls, and 195px of dead
                controls pinned to the bottom of a phone is exactly what shoved
                the one live control off the screen. The counter above keeps
                the desk accounted for while the row is away. */}
            <SeatRow run={run} live={live} pressed={pressed} options={options}
                     onPress={press} />

            <Nav lastClaim={lastClaim} pressed={pressed} onAdvance={advance} onCallIt={callIt} />
          </div>
          )}
        </div>
      )}

      {/* ---------- the call ---------- */}
      {run.phase === PHASE.ALLOCATION && (
        <div className="pf-scroll center">
          <div className="pf-label">YOUR CALL — {deal.ticker}</div>
          <input className="pf-slider" type="range" min={-100} max={100} step={5}
                 value={slider} onChange={(e) => setSlider(Number(e.target.value))} />
          <div className="pf-ends"><span>SHORT</span><span>FLAT</span><span>LONG</span></div>
          <div className="pf-saying">{readout.saying}</div>
          <div className="pf-risk">{readout.risk}</div>
          <button className="pf-btn primary" onClick={lockCall}>LOCK IT IN</button>
        </div>
      )}

      {/* ---------- resolution ---------- */}
      {run.phase === PHASE.RESOLUTION && (
        <div className="pf-scroll center">
          <div className={`pf-pnl ${run.call.pnl >= 0 ? "up" : "down"}`}>
            {run.call.pnl >= 0 ? "+" : ""}{Math.round(run.call.pnl)}
          </div>
          <div className="pf-label">{run.call.pnl >= 0 ? "YOU READ IT RIGHT" : "YOU GOT IT WRONG"}</div>
          <p className="pf-copy">{deal.resolution}</p>
          <button className="pf-btn primary" onClick={finish}>WHAT WAS ACTUALLY SAID ▸</button>
        </div>
      )}

      {/* ---------- autopsy ---------- */}
      {run.phase === PHASE.AUTOPSY && (
        <div className="pf-scroll">
          {/* POST-DEAL ANALYSIS, not THE AUTOPSY — see the note on the desktop
              panel. An autopsy presumes a corpse, and a third of these deals
              are legit. */}
          <div className="pf-label">POST-DEAL ANALYSIS</div>
          <div className="pf-scores">
            <div><em>READ</em><b>{read.hit}/{read.spent || 0}</b></div>
            <div><em>BOOK</em><b>{Math.round(run.book)}</b></div>
          </div>
          {/* THE PATTERN. See the note on the desktop panel: this led with a
              DIFFERENT token's name under a headline claiming the player had
              seen it before, which is false on a first play. Pattern first,
              this deal tied to it, then the classic case as a separate box. */}
          <div className="pf-pattern">
            <div className="pf-label">THE PATTERN</div>
            <div className="pf-name sm">{deal.archetypeLabel}</div>
            <div className="pf-pattern-was">{deal.name} was one of these.</div>

            {/* THE TELL, not the exemplar coin — see the note on the desktop
                panel. The player has their own concrete case; what they can't
                get from it is the rule that survives the token. */}
            {deal.archetypeTell && (
              <div className="pf-pattern-case">
                <div className="pf-pattern-caselabel">THE TELL</div>
                <p className="pf-copy sm">{deal.archetypeTell}</p>
              </div>
            )}

            <p className="pf-copy sm dim">
              Same shape, different token. Learn it and you get every one of these.
            </p>
          </div>
          {deal.claims.map((c) => (
            <div key={c.id} className={`pf-au ${run.outcomes[c.id] ? "pressed" : ""}`}>
              <div className="pf-au-fact">{c.fact}</div>
              <div className="pf-au-verdict">{deal.autopsy[c.id]}</div>
            </div>
          ))}
          <button className="pf-btn primary" onClick={onExit}>LEAVE THE DESK</button>
        </div>
      )}
    </div>
  );
}

// PRESS_UI_CSS WAS IMPORTED AND NEVER CONCATENATED. The shared floor's styles
// — the seat row, the claim body, the meter — have never loaded on this
// surface. It went unnoticed because every .pu-seat used to contain a
// TradingCard, which sizes itself, so an unstyled button still looked roughly
// right. Swapping the card for a plain <img> on 2026-07-28 removed the mask and
// the portraits rendered at their native 600px.
//
// The lesson is the one pressUi.jsx's header already makes about state gating:
// a surface can go a long way on a stylesheet it never actually included, as
// long as its children are self-sizing.
const CSS = ENGAGEMENT_CSS + PRESS_UI_CSS + `
.pf-wrap { position:absolute; inset:0; display:flex; flex-direction:column;
  background:
    linear-gradient(90deg, rgba(41,58,65,.32) 0 8px, transparent 8px calc(100% - 8px), rgba(41,58,65,.32) calc(100% - 8px)),
    radial-gradient(100% 60% at 50% 24%, rgba(68,53,8,.18), transparent 72%),
    #000706;
  color:#eafff9; font-family:'IoskeleyMono','Courier New',monospace;
  overflow:hidden;
  /* PORTRAIT-FIRST, at any width. On a phone this is the whole screen; on
     desktop (?flat=1) it centres as a phone-shaped column with the room's
     dark behind it, so the fallback reads as intentional rather than as a
     stretched mobile page. */
  width:min(520px, 100%); margin:0 auto;
  border-left:1px solid rgba(47,214,214,0.16);
  border-right:1px solid rgba(47,214,214,0.16); }
@media (max-width:560px) { .pf-wrap { border:none; } }

.pf-market-rail {
  flex:none; display:grid; grid-template-columns:1.1fr .85fr 1fr;
  margin:9px 11px 0; border:1px solid rgba(47,214,214,.18);
  background:rgba(2,18,17,.72);
  clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
}
.pf-market-rail span {
  min-width:0; padding:7px 9px; color:#b9d8d3;
  font-size:8px; letter-spacing:.1em; white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis;
}
.pf-market-rail span + span { border-left:1px solid rgba(47,214,214,.12); }
.pf-market-rail i {
  display:block; margin-bottom:2px; color:rgba(47,214,214,.5);
  font-style:normal; font-size:6.5px; letter-spacing:.17em;
}
.pf-market-rail span:first-child { color:#ffd23a; }

.pf-scroll {
  flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch; padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));
}
.pf-scroll.center { display:flex; flex-direction:column; justify-content:center; text-align:center; }
.pf-label { margin:10px 0 7px; color:#2fd6d6; font-size:10px; letter-spacing:.16em; }
.pf-copy { margin:8px 0; color:#c8e5df; font-size:12px; line-height:1.48; }
.pf-copy.sm { font-size:10.5px; }
.pf-copy.dim { color:rgba(200,229,223,.58); }
.pf-copy.gold { color:#ffd23a; }

/* START SCREEN — a mandate intake terminal, not a document page. */
.pf-start { padding-top:13px; }
.pf-start-head { position:relative; margin:0 0 12px; padding:0 2px; }
.pf-eyebrow {
  color:#ffd23a; font-size:8px; letter-spacing:.2em;
}
.pf-start-head h1 {
  margin:6px 0 5px; font-family:'Orbitron','IoskeleyMono',monospace;
  color:#eafff9; font-size:20px; line-height:1.06; letter-spacing:.04em;
  font-weight:700;
}
.pf-start-head h1 span {
  color:#ffd23a; text-shadow:0 0 15px rgba(255,210,58,.22);
}
.pf-start-head p {
  margin:0; max-width:330px; color:#81aaa4; font-size:9.5px;
  line-height:1.4; letter-spacing:.035em;
}

/* The top padding is the TAB BAND now, not readout clearance: the deal file's
   tab rides the record's top edge at -17px and lives in this padding, and the
   polaroid's paperclip reaches higher still — the inner comment documents the
   exact value. The readout that used to sit here is gone — see the render
   site. */
.pf-record-shell {
  /* 28px, not 22: the paperclip reaches ~25px above the record's top edge and
     the shell's clip-path would shear it at the old padding. */
  position:relative; padding:28px 8px 8px;
  border:1px solid rgba(47,214,214,.3);
  background:linear-gradient(145deg,#19211f,#08100f 34%,#020504 78%);
  box-shadow:0 9px 22px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.025);
  clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,11px 100%,0 calc(100% - 11px));
}
.pf-record-shell::before {
  content:""; position:absolute; inset:3px; pointer-events:none;
  border:1px solid rgba(255,210,58,.12);
}

/* The record remains a document, but now sits inside the same spectral glass
   housing as the other channel displays. */
.pf-start .eng {
  border-color:rgba(255,210,58,.24); border-left-color:rgba(239,98,220,.65);
  background:
    repeating-linear-gradient(0deg,rgba(0,0,0,.12) 0 1px,transparent 1px 3px),
    linear-gradient(180deg,rgba(8,26,23,.92),rgba(1,10,9,.94));
}
.pf-start .eng.in { border-color:rgba(255,210,58,.48); }
.pf-start .eng-title {
  font-family:'Orbitron','IoskeleyMono',monospace; font-size:11px;
}
.pf-start .eng-body { gap:10px; padding:10px 10px 0; }
.pf-start .eng-frame { width:62px; }
.pf-start .eng-terms { flex-basis:145px; }
.pf-start .eng-client { font-size:14px; }
.pf-start .eng-stats { display:grid; grid-template-columns:1fr 1fr; gap:3px 12px; }
.pf-start .eng-stats dt { width:45px; }
.pf-start .eng-particulars { flex-basis:100%; }

/* THE SEALED-STATE CSS IS GONE WITH ITS MARKUP (2026-08-03). The collapse hacks
   went with it: the record renders its full blank form at rest — mounted,
   in flow, covering its own rest state — and the deal file's cover (see
   ENGAGEMENT_CSS) is what withholds it. Do not reintroduce a rest-state
   overlay here; anything the rest state wants to say belongs on the cover,
   and the cover already says everything a closed file needs to. */

.pf-protocol {
  display:grid; grid-template-columns:repeat(3,1fr); margin-top:10px;
  border:1px solid rgba(255,210,58,.2); background:rgba(42,34,7,.12);
}
.pf-protocol div {
  min-width:0; padding:8px 7px 7px; display:flex; align-items:baseline;
  gap:5px;
}
.pf-protocol div + div { border-left:1px solid rgba(255,210,58,.14); }
.pf-protocol b {
  color:#ffd23a; font-family:'Orbitron','IoskeleyMono',monospace;
  font-size:12px; font-weight:600;
}
.pf-protocol span { color:#91b7b0; font-size:6.5px; letter-spacing:.11em; }
.pf-directive {
  margin:8px 2px 11px; color:#b7d5cf; font-size:9.5px; line-height:1.45;
}
.pf-section-line {
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding-top:8px; border-top:1px solid rgba(47,214,214,.16);
  color:#2fd6d6; font-size:8px; letter-spacing:.16em;
}
.pf-section-line i {
  color:rgba(255,210,58,.58); font-style:normal; font-size:6.5px;
}

/* THE DESK STRIP. These had NO CSS AT ALL until 2026-07-29 — .pf-strip and
   .pf-face existed only as class names, so the four portraits fell back to
   block layout and stacked. Styling them was forced by giving Virgil a divider
   at the end of the row: an unstyled 1px span in a block flow is invisible.
   Five tiles wrap on a narrow phone, which is fine — the cat wrapping onto its
   own line still reads as "and the cat", never as a fifth seat. */
/* Kept for the POST-DEAL pattern label, which is the only .pf-name left — the
   briefing's headline was cut when the record took the reveal. Archetype labels
   are long and this column gets down to ~266px. */
.pf-name { overflow-wrap:anywhere; }

/* The house rules, as plain copy. Their block used to share a grid cell with the
   dossier; the dossier moved inside the record, so the cell went with it. */
/* .pf-roll-cap went with the caption it styled. */
.pf-strip { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:5px; margin:7px 0 0; min-width:0; }
.pf-face { min-width:0;
  display:flex; flex-direction:column;
  align-items:center; gap:3px; text-align:center; }
.pf-face-pic { width:40px; height:40px; object-fit:cover; border-radius:50%;
  border:1px solid rgba(47,214,214,0.35); background:#020f0d;
  box-shadow:0 0 12px rgba(47,214,214,.08); }
/* Two lines reserved for every name — "Detective Marisol" wraps and the others
   don't, which would drop her role label a line below everyone else's. */
.pf-face-who { font-size:7px; font-weight:bold; letter-spacing:0.02em;
  color:rgba(234,255,249,0.92); line-height:1.2; min-height:2.4em;
  display:flex; align-items:center; justify-content:center; }
/* THE LANE IS THE POINT of this strip — it is the one fact a new player needs
   from it (author, 2026-08-03: the SME labels were "low contrast and small").
   Readable at REST, because touch has no hover; hover adds the zoom, gated on
   (hover:hover) so phones never get a stuck-hover state. Not a button — the
   zoom is a reading aid, and nothing here gains a click. */
.pf-face-role { font-size:7px; letter-spacing:0.08em; color:#ffd23a; }
@media (hover:hover) {
  .pf-face-pic { transition:transform .18s ease; }
  .pf-face:hover .pf-face-pic { transform:scale(1.22); }
  .pf-face:hover .pf-face-role { color:#ffe27a; }
}

/* VIRGIL, at the end of the strip and set apart from it on purpose — not a seat,
   no lane, cannot be sent. The divider carries that; don't tidy it away. */
.pf-face-div { display:none; }
.pf-face-cat .pf-face-pic { border-color:rgba(191,238,222,0.5); }
.pf-face-cat .pf-face-who { color:#bfeede; }
.pf-face-cat .pf-face-role { color:rgba(191,238,222,0.75); }
.pf-face-note { font-size:5.5px; letter-spacing:0.08em;
  color:rgba(191,238,222,0.5); margin-top:1px; }

/* ------------------------------------------------------------------------
   THE FLOOR. RESTORED 2026-08-02 — every rule from here to the pf-look
   keyframes went missing in one edit (bce2850, "enigma game updates", which
   rewrote this file's markup and took 447 lines with it) and nothing has
   styled the floor since. It is the same class of failure the header note
   records about PRESS_UI_CSS never being concatenated, with the opposite
   symptom: there, self-sizing children hid the absence for weeks; here the
   floor is four flex children of a column that was no longer a column, so it
   collapsed to 147px inside a 698px wrap — the figure at 2px tall, the tabs
   as raw browser buttons, no dock on screen at all.

   IT ALSO SILENTLY REVIVED A DOCUMENTED BUG. .pf-read carries the note above
   about being the only thing on the floor that scrolls, and about the dock
   running off the bottom when it wasn't; with .pf-read having no overflow
   that was true again. If you ever delete from this block, check the prose
   upstairs still describes what the CSS does.
   ------------------------------------------------------------------------ */
.pf-floor { flex:1; display:flex; flex-direction:column; min-height:0; }

/* flex:0 1 auto — the feed gives up height before the words do. */
.pf-stage { flex:0 1 auto; height:30vh; min-height:140px; max-height:330px; padding:10px 0;
  display:flex; justify-content:center; align-items:center; overflow:hidden;
  background:radial-gradient(ellipse at 50% 35%, rgba(255,45,111,0.14), transparent 68%); }
.pf-stage > * { height:100%; }

.pf-read { flex:1 1 auto; min-height:76px; overflow-y:auto; overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch; padding-bottom:8px; }
/* only while something IS below — so the last line is never the faded one */
.pf-read.more { -webkit-mask-image:linear-gradient(180deg, #000 calc(100% - 24px), transparent);
  mask-image:linear-gradient(180deg, #000 calc(100% - 24px), transparent); }

.pf-agenda { flex:none; display:flex; gap:5px; overflow-x:auto; padding:8px 12px 6px;
  -webkit-overflow-scrolling:touch; }
.pf-ag { flex:0 0 auto; font:bold 9.5px/1 'Courier New',monospace; letter-spacing:0.07em;
  padding:7px 9px; border:1px solid rgba(234,255,249,0.16); color:rgba(234,255,249,0.45);
  white-space:nowrap; position:relative; }
.pf-ag::before { content:""; display:inline-block; width:5px; height:5px; border-radius:50%;
  margin-right:5px; vertical-align:middle; background:rgba(234,255,249,0.3); }
/* THE LANE DOTS. They say who COULD settle each subject, never whether it is
   worth settling — same colours as .pu-lane in pressUi, so a dot on the rail
   and the band under the claim are obviously the same fact. CHART and SOCIAL
   were missing here and fell back to the neutral dot; the rail was quietly
   answering "whose is this" for two lanes out of four. */
.pf-ag[data-lane="CHAIN"]::before  { background:#2fd6d6; }
.pf-ag[data-lane="RECORD"]::before { background:#ffd23a; }
.pf-ag[data-lane="CHART"]::before  { background:#ff5f9e; }
.pf-ag[data-lane="SOCIAL"]::before { background:#bfeede; }
.pf-ag.past { opacity:0.4; }
.pf-ag.now  { border-color:#ff5f9e; color:#fff; }
.pf-ag.done { border-style:dashed; }

/* THE BOARD COLUMN: one panel, then the strip that switches between them. It
   takes the stage's whole height so the panel can be sized against something
   definite — see the canvas note below. min-height:0 because a flex item's
   default min-height:auto would let the canvas push the strip out of the
   clipped stage rather than shrink. */
.pf-boards { width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:7px; }
.pf-bstrip { flex:none; display:flex; gap:4px; }
.pf-bchip { flex:1; min-width:0; background:rgba(2,16,14,0.85);
  border:1px solid rgba(47,214,214,0.22);
  color:rgba(234,255,249,0.6); font:bold 10px/1.35 'Courier New',monospace;
  letter-spacing:0.07em; padding:7px 4px; cursor:pointer;
  display:flex; flex-direction:column; gap:2px; }
.pf-bchip.on { border-color:#2fd6d6; color:#2fd6d6; background:rgba(47,214,214,0.08); }
.pf-bchip em { font-style:normal; font-weight:normal; font-size:9px; opacity:0.8; }
.pf-bchip.rec em { color:#ffd23a; opacity:1; }
.pf-bchip.nil em { color:#ff9b6f; opacity:1; }

.pf-tabs { flex:none; display:flex; gap:1px; margin:0 12px; }
.pf-tabs button { flex:1; min-width:0; background:rgba(2,16,14,0.9);
  border:1px solid rgba(47,214,214,0.22);
  border-bottom:none; color:rgba(234,255,249,0.5); font:bold 9.5px/1 'Courier New',monospace;
  letter-spacing:0.11em; padding:9px 6px; cursor:pointer; }
.pf-tabs button.on { color:#2fd6d6; border-color:rgba(47,214,214,0.5);
  background:rgba(47,214,214,0.08); }
.pf-tabs em { font-style:normal; font-weight:normal; opacity:0.7; }
.pf-tabs em.rec { color:#ffd23a; opacity:1; }
/* GO AND LOOK. Cyan, deliberately — the tab's own accent, carrying no verdict.
   Gold is the receipt colour, so pulsing gold would announce a receipt before
   you'd been to see one, which is the whole thing this beat withholds. */
.pf-tabs button.look { color:#2fd6d6; border-color:rgba(47,214,214,0.6);
  animation:pf-look 1.15s ease-in-out infinite; }
.pf-tabs button.look em { opacity:1; font-weight:bold; }
@keyframes pf-look {
  0%, 100% { background:rgba(47,214,214,0.05); box-shadow:0 0 0 rgba(47,214,214,0); }
  50%      { background:rgba(47,214,214,0.20); box-shadow:0 0 15px rgba(47,214,214,0.45); }
}

/* .pf-look is GONE. It was this surface's private LOOK button under the answer;
   it is now one of the two moves in the shared AnswerChoice (.pu-choice-btn), so
   both surfaces word and style the beat identically. Its rule was still here —
   the styling for a button no caller renders. The tab still does the attracting,
   and it is still the only thing that pulses: two at once reads as an error
   state rather than a nudge. */
@media (prefers-reduced-motion:reduce) {
  .pf-tabs button.look { animation:none; background:rgba(47,214,214,0.20);
    box-shadow:0 0 15px rgba(47,214,214,0.45); }
}

.pf-pane { display:none; width:100%; height:100%; justify-content:center; align-items:center; }
.pf-pane.show { display:flex; }
.pf-pane.wide { padding:0 12px; }
/* SIZED BY HEIGHT, WHICH IS THE AXIS THAT'S SCARCE. width:100% derives the
   height from the 512x320 bitmap, so on anything wider than ~345px the bottom
   of the receipt was cropped by the stage's overflow:hidden — the one panel
   whose emptiness is the product, clipped.
   Two dead ends on the way here, both of which LOOK correct and silently do
   nothing: max-height:100% goes indefinite through this parent chain and
   Chrome drops the constraint (measured 228px tall in a 165px box), and as a
   GRID item the canvas resolves height:100% against an auto row track, which
   is circular, so the percentage falls back to auto. BOTH ARE THE SAME BUG —
   a percentage against an indefinite ancestor — and the fix below is to stop
   asking for one. */
/* ONE BOARD AT A TIME, and this was missing. .pf-screen had no hidden state,
   so all four rendered stacked inside .pf-boards — boardPane has been writing
   .show since the strip was built and NOTHING WAS READING IT. On a phone the
   bug is masked: .pf-stage is a short overflow:hidden box, so you see the first
   one and assume it's the only one. It is plainly wrong anywhere taller (?flat=1
   on a desktop), and it breaks the beat it exists for — SEE WHAT LANDED sends
   you to an ANALYST's finding and the top of the stack is the PITCHER's board.
   Found while wiring that choice, 2026-08-02. */
.pf-screen { display:none; }
/* THE PANEL TAKES WHAT'S LEFT after the strip, and is POSITIONED so the canvas
   inside it has a definite box to measure against. That last part is the whole
   trick: height:100% on the canvas needs a definite ancestor height, and a flex
   item sized by flex:1 is definite only AFTER layout — which is exactly the
   indefinite-chain failure the note above records. An absolutely positioned
   child resolves its percentages against the padding box of its positioned
   ancestor, which IS definite, so max-width/max-height:100% plus margin:auto
   fits the receipt to whichever axis is scarce and centres it in the other.
   (NO BACKTICKS IN THIS BLOCK — it is inside a template literal, and one in a
   comment ends the stylesheet mid-rule. It took the page down once.) */
.pf-screen.show { display:block; position:relative; flex:1 1 auto; min-height:0; }
.pf-screen canvas { position:absolute; inset:0; margin:auto;
  width:auto; height:auto; max-width:100%; max-height:100%;
  aspect-ratio:512/320; border:1px solid rgba(47,214,214,0.3); }

/* holds the verdict's place while he's still saying it, so the panel doesn't
   jump when the real line arrives */

/* PINNED, AND ON A HEIGHT BUDGET. It carries the only controls that move the
   game forward, so anything added here is taken off the reading column above.
   Roughly 195px while a press is live, ~95px once it isn't. */
/* mobile skins on the shared floor: gutters, and the advisers badge that
   rides along in the meter's child slot */
.pf-read .pu-claim { margin:0 12px; }
.pf-read .pu-answer { margin:10px 12px 0; }
.pf-dock .pu-meter { margin-bottom:8px; }
/* keeps the desk accounted for in the beats where the seat row isn't shown */
.pf-dock .pu-meter b { margin-left:auto; font-size:8.5px; letter-spacing:0.11em;
  color:rgba(47,214,214,0.75); }
.pf-dock .pu-nav { margin-top:8px; }
.pf-dock .pu-seats { flex-wrap:wrap; justify-content:flex-start; }

.pf-dock { flex:none; padding:9px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  border-top:1px solid rgba(47,214,214,0.25); background:rgba(2,16,14,0.96); }
/* keeps the hand accounted for in the beats where the strip isn't shown */

.pf-cta-row {
  position:sticky; z-index:4; bottom:calc(-18px - env(safe-area-inset-bottom,0px));
  margin:4px 0 -18px; padding:12px 0 calc(18px + env(safe-area-inset-bottom,0px));
  background:linear-gradient(0deg,#000706 72%,transparent);
}
.pf-btn { background:rgba(2,16,14,0.9); border:1px solid rgba(47,214,214,0.5); color:#2fd6d6;
  font:inherit; font-size:11.5px; letter-spacing:0.09em; padding:12px 14px; cursor:pointer;
  display:block; width:100%; }
.pf-btn.amber { border-color:rgba(255,210,58,0.55); color:#ffd23a; }
.pf-btn.ghost { width:auto; }
.pf-btn.primary { background:#ff2d6f; border:none; color:#fff; font-weight:bold;
  font-size:14px; letter-spacing:0.14em; padding:15px;
  box-shadow:0 0 22px rgba(255,45,111,0.45); }
.pf-btn.primary small { display:block; font-weight:normal; font-size:9.5px;
  letter-spacing:0.05em; opacity:0.85; margin-top:2px; }
/* the nav-row weight of primary — same signal, a third of the height */
.pf-btn.primary.sm { font-size:12px; letter-spacing:0.1em; padding:12px 10px;
  box-shadow:0 0 16px rgba(255,45,111,0.38); }
.pf-btn.primary:disabled { background:rgba(120,120,120,0.35); box-shadow:none; color:rgba(255,255,255,0.5); }
.pf-btn:not(.primary) { margin-top:8px; }
.pf-start .pf-btn.primary {
  position:relative; overflow:hidden;
  background:linear-gradient(90deg,#3a2d05,#ffd23a 48%,#3a2d05);
  border:1px solid rgba(255,210,58,.8); color:#07100d;
  font-family:'Orbitron','IoskeleyMono',monospace; font-size:12px;
  text-shadow:0 1px rgba(255,255,255,.25);
  box-shadow:0 0 20px rgba(255,210,58,.2),inset 0 0 18px rgba(255,255,255,.14);
  clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,11px 100%,0 calc(100% - 11px));
}
.pf-start .pf-btn.primary::after {
  content:""; position:absolute; inset:4px; border:1px solid rgba(5,15,12,.23);
  pointer-events:none;
}
.pf-start .pf-btn.primary:focus-visible {
  outline:1px solid #fff; outline-offset:2px;
}
.pf-start .pf-btn.primary:disabled {
  background:#25312e; border-color:rgba(142,171,165,.28); color:#6d8781;
}

.pf-slider { width:100%; max-width:420px; accent-color:#ff2d6f; }
.pf-ends { display:flex; justify-content:space-between; width:100%; max-width:420px;
  font-size:9px; letter-spacing:0.11em; color:rgba(234,255,249,0.5); margin-top:4px; }
.pf-saying { font-size:15px; margin-top:16px; }
.pf-risk { font-size:12px; color:#ffd23a; margin-top:7px; }
.pf-pnl { font-size:52px; font-weight:bold; }
.pf-pnl.up { color:#4dffaa; text-shadow:0 0 24px rgba(77,255,170,0.5); }
.pf-pnl.down { color:#ff5f6f; text-shadow:0 0 24px rgba(255,95,111,0.5); }

.pf-scores { display:flex; gap:24px; margin:4px 0 12px; }
.pf-scores em { font-style:normal; font-size:9px; letter-spacing:0.12em; display:block;
  color:rgba(234,255,249,0.5); }
.pf-scores b { font-size:22px; color:#ffd23a; }
.pf-pattern { margin:8px 0 16px; padding:11px;
  background:rgba(255,210,58,0.05); border:1px solid rgba(255,210,58,0.28); }
.pf-pattern .pf-label { margin-top:0; }
/* THIS deal, tied to the pattern by name — the line whose absence made the
   exemplar look like the subject of the screen. */
.pf-pattern-was { font-size:12px; color:rgba(234,255,249,0.85); margin:4px 0 10px; }
/* The tell, boxed so it reads as the portable lesson rather than more prose
   about this one deal. */
.pf-pattern-case { padding:9px 10px;
  border:1px solid rgba(255,210,58,0.22); background:rgba(0,0,0,0.28); }
.pf-pattern-caselabel { font:bold 8px/1.4 'Courier New',monospace;
  letter-spacing:0.12em; color:rgba(255,210,58,0.7); margin-bottom:3px; }
.pf-pattern-case .pf-copy { margin:0; }
.pf-au { border-left:2px solid rgba(234,255,249,0.16); padding:7px 0 7px 10px; margin-bottom:10px; }
.pf-au.pressed { border-left-color:#ffd23a; }
.pf-au-fact { font-size:12px; }
.pf-au-verdict { font-size:11px; color:#2fd6d6; margin-top:3px; }
`;
