"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, rollSeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, PITCHER, SEATS, SEAT_LANE, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, DESK_ORDER, PITCH_BOT, laneOwner, laneSentence, pitchOpening, pitcherAside, seatMeta } from "@/game/terminal-traders/press/desk";
import { pitcherVoice } from "@/game/terminal-traders/press/pitchers";
import { VIRGIL, virgilRead, briefing,
         afterAnswer as virgilAfterAnswer } from "@/game/terminal-traders/press/virgil";
import { briefingMode, markBriefingSeen } from "@/lib/trade/briefingSeen";
import {
  PHASE, PRESSES,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt, seatOptions,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, stakeFor, pressPrice, callVerdict, betRestated, coverageScore, laneOutlook, pressure,
  settlementNote,
} from "@/game/terminal-traders/press/pressRun";
import { speakAdviserLine, stopAdviserAudio, unlockAdviserAudio } from "@/lib/counselSpeech";
import { speakVirgilLine, stopVirgilLine } from "@/lib/trade/virgilVoice";
import { seatHasPortal, speakSeatLine, warmSeatPortal } from "@/lib/trade/seatVoice";
import PressFigure from "./PressFigure";
import { preloadSfx } from "@/lib/uiSfx";
import gsap from "gsap";
import {
  EngagementRecord, runArrival, endArrival, skipArrival, prefersReducedMotion, SFX,
  ENGAGEMENT_CSS, peekFileNo, commitFileNo,
} from "./engagement";
import { createFlatEvidenceScreen } from "./evidenceScreen";
import { createPitchDeck } from "./pitchDeck";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, AnswerChoice, OpeningBody, SeatRow,
  ConvictionGauge,
  Meter, Nav, readDwellMs, VIRGIL_BEAT_MS, PRESS_UI_CSS,
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

/* WHO HAS A SCREEN. Module scope because it is a fixed fact about the room, not
   a per-render value — it was a useMemo with an empty dep list, which is the
   same constant with a hook around it, and `screenOwner` is derived above the
   line the memo used to sit on. */
const BOARDS = [PITCHER, SEATS.MARISOL, SEATS.GR80, SEATS.EUGENE];
const BOARDS_SET = new Set(BOARDS);

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
  // HOW MUCH OF VIRGIL HAS BEEN SPOKEN on this claim — 0 none, 1 his read, 2
  // the consequence. Driven by the claim turn's onPart so his panel can never
  // show a line the voice has not reached. See VirgilRead's `reveal`.
  const [virgilAt, setVirgilAt] = useState(0);
  /* WHO THE FEED IS POINTED AT. Desktop cuts the camera to whoever is talking
     (PressSession's "THE CAMERA FOLLOWS THE VOICE, NOT THE PRESS"); this surface
     had one fixed shot of the pitcher, so an adviser you had just spent went and
     looked, reported, and never appeared. It follows the voice for the same
     reason desktop does, and it HOLDS on the reporter afterwards rather than
     snapping back — their finding is what you are reading at that moment. Back
     to the pitcher when the next claim starts. */
  const [onCamera, setOnCamera] = useState(PITCHER);
  /* FEED | BOARD | DECK. Not just a space-saver on a phone: a press CUTS to a
     screen, so "nothing landed" is something you went and looked at rather
     than something you passively failed to notice.
     THREE, NOT TWO, since 2026-08-04. The old pair was feed | screen, where
     "screen" was a switcher over four boards with different owners. They are
     separated now because ownership is the thing this surface kept getting
     wrong: BOARD is an analyst's finding and belongs with that analyst, DECK
     is the bot's own presentation and belongs to the bot. `board` has no tab —
     it is reached by going to look at what you sent someone for, and it comes
     down when the claim does. */
  const [pane, setPane] = useState("feed");
  // Mirrored into state because the tab label reads it during render — a ref
  // would never re-render and the badge would stay stale after a press.
  const [hasRecord, setHasRecord] = useState(false);
  /* WHOSE SCREEN THE SECOND PANE IS SHOWING, and it is not state — it is the
     camera, read. `onCamera` already holds on whoever last spoke (the pitcher
     between presses, the analyst who reported through the beat that follows
     one), so a separate selection could only ever agree with it or be a bug.
     Virgil takes the camera to say the agenda and has no screen, so anyone
     without a board falls back to the deck: the bot's slides are what is on
     screen whenever nobody's own findings are. */
  /* THE FINDING OUTRANKS THE CAMERA WHILE THERE IS A FINDING.
     The camera-only rule above held while it was true that "the camera is
     already on the reporter by the time this is offered" — and Virgil's
     after-answer turn ended that. He carries `seat: VIRGIL.id` and has no
     board, so ~2.4s after EVERY analyst report the camera landed on him, this
     fell through to PITCHER, and the tab silently became ▦ PITCH DECK — while
     it was still pulsing LOOK and the note under it still said "on Marisol's
     screen". The single most expensive action in the game handed you the
     seller's slide.
     `flash.board` is set by resolvePress and cleared by advance() and callIt(),
     so this override has exactly the lifetime of the answer beat and needs no
     reset of its own — which is what the note at the flash reset requires
     ("screenOwner is derived, not stored"). Pitcher presses fall through
     unchanged, because the pitcher's board IS the deck. */
  const screenOwner = (flash && BOARDS_SET.has(flash.board)) ? flash.board
    : BOARDS_SET.has(onCamera) ? onCamera : PITCHER;
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
  const clientRef = useRef(null);
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
      client: clientRef.current,
      clientText: deal.name,
      stampRetained: stampRetainedRef.current,
      particulars: particularsRef.current,
      onSettled: () => setSettled(true),
      onDone: () => { setRolling(false); setRolled(true); },
    });
    if (!tl) { setRolling(false); setSettled(true); setRolled(true); return; }
    tlRef.current = tl;
  }, [rolling, rolled]);

  const skipRoll = useCallback(() => {
    if (rolling) skipArrival(tlRef.current);
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
  // THE REMARKS FINISHING AND THE FLOOR OPENING ARE TWO EVENTS, and the button
  // between them is the player's. Same seam, same three states, as PressSession —
  // see the gate note on OpeningBody for what the beat is for.
  const [openingDone, setOpeningDone] = useState(false);
  const [opened, setOpened] = useState(false);
  const floorLive = onFloor && opened;

  /* ---- Virgil's house rules, before any of that ----
     Mirrors PressSession: mode resolved in a mount effect (never in the
     initialiser — briefingMode reads localStorage and the query string), and
     `briefed` is the opening's gate. */
  const [briefMode, setBriefMode] = useState(null);
  const [briefAt, setBriefAt] = useState(-1);
  const [briefDone, setBriefDone] = useState(false);
  const [briefed, setBriefed] = useState(false);
  const briefLines = useMemo(
    () => (briefMode && briefMode !== "off" ? briefing(briefMode === "short") : []),
    [briefMode]);

  useEffect(() => {
    const m = briefingMode();
    setBriefMode(m);
    if (m === "off") setBriefed(true);
  }, []);

  // Who can be sent at the claim on the floor, and why not. Straight from the
  // controller so the button states can never disagree with the rules.
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
  const readout = useMemo(() => callReadout(slider, stakeFor(run)), [slider, run]);
  // The reveal headline. Four bands (callVerdict), not a sign test on the payout.
  const verdict = useMemo(() => callVerdict(run, deal), [run, deal]);
  const read = useMemo(() => coverageScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;
  // A press is legal only while he's on a claim you haven't already answered
  // and you still have budget. The dock shows the press affordances ONLY then
  // — see the note on .pf-dock below for why that's structural, not cosmetic.
  // The predicate itself lives in pressUi so both surfaces gate identically;
  // this file having its own copy is how desktop ended up referencing a
  // `canPress` that was never declared there.
  const live = pressIsLegal(run, claim);
  // A REPORT IS ON SCREEN FOR THIS CLAIM. Gates the column swap below — the
  // claim body stands down for the length of the answer — and it is `flash`
  // rather than `pressed` on purpose: `pressed` stays true once you have had
  // your answer, so keying on it would hide the claim for the rest of the beat
  // including after the answer panel has been dismissed by moving on.
  const answering = !!flash && !!claim && flash.id === claim.id;
  /* WHOSE PLAYER TO KEEP WARM — the lane owner of the claim being made now.
     A SitePal portal needs several seconds to register sayText, and a press
     produces its one adviser line a beat later, so mounting on the press is the
     cold-start failure PressFigure's Virgil note already records having made
     once. Mounting on the CLAIM buys the bot's spin plus the cat's line, and
     the seat row does not appear until that speech ends — so the earliest legal
     press is already past the boot window.
     The lane owner rather than all four because it is the seat the lane band is
     pointing at and by far the likeliest spend; press somebody else and they
     take the voice-only path, which is the same fallback a failed boot takes. */
  const portalSeat = useMemo(() => {
    const owner = claim ? laneOwner(claim) : null;
    return owner && seatHasPortal(owner.id) ? owner.id : null;
  }, [claim]);
  const lastClaim = run.claimIndex >= deal.claims.length - 1;
  const advisersLeft = SPENDABLE_SEATS.filter((x) => !run.advisersSpent.includes(x)).length;
  // VIRGIL, NOT A SEAT. The guidance is the cat's: free, automatic, and never a
  // press — he reads the shape of every claim and points at whose lane it is,
  // never at whether it is true, and he never stamps a receipt, so he cannot
  // carry the answer. Reads the run as well as the claim, so he stops naming an
  // adviser you've already spent. EUGENE IS A PLAIN SEAT — the exemption was
  // his through three failed placements and moving it to a cat is what dissolved
  // it ([A§9]; the whole argument is in virgil.js).
  // `tips` is the player's — the agenda half ignores it, per §3's split.
  const [tips, setTips] = useState(true);
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
  // BOARDS moved to module scope — see the note there.
  const screensRef = useRef({});
  useEffect(() => {
    if (!started) return;
    const made = {};
    for (const seat of BOARDS) {
      const el = document.getElementById(`pf-screen-${seat}`);
      if (!el) continue;
      // THE PITCHER'S BOARD IS NOT AN EVIDENCE TERMINAL ANY MORE. It used to be
      // one — the same cyan receipt screen the three analysts have — which made
      // the one surface in the room that is SELLING you something look exactly
      // like the three that are checking it. See pitchDeck.js: it takes the
      // same contract (setClaim/stamp/stayBlack/dispose) so nothing else here
      // has to know which kind of board it is holding.
      made[seat] = seat === PITCHER
        ? createPitchDeck(el, { ticker: deal.ticker })
        : createFlatEvidenceScreen(el, { header: seatMeta(seat).name.toUpperCase() });
    }
    screensRef.current = made;
    made[SEATS.BARRON] = made[PITCHER];   // alias — see BOARDS note
    screenRef.current = made[PITCHER] || null;
    return () => {
      Object.values(made).forEach((x) => x.dispose());
      screensRef.current = {}; screenRef.current = null;
    };
  }, [started, deal.ticker]);

  /* THE DECK FOLLOWS THE RUNNING ORDER. One slide per claim, swapped when the
     claim does — the deck is what the bot is presenting FROM, so it cannot sit
     on the previous point while it argues the next one.
     It reads `claim` and nothing else: no outcome, no branch, no pressure. The
     leak argument is pitchDeck.js's header, and it is the shield's (§1 rule 3)
     — a surface keyed only to slot-level fields is auditable, and every field
     it touches is already on screen in the agenda rail. */
  useEffect(() => {
    if (!started || !claim) return;
    screensRef.current[PITCHER]?.setClaim?.(claim, deal.surface);
  }, [started, claim, deal.surface]);

  /* ---- he says it out loud ----
     Token-guarded. A press interrupts the claim he's mid-way through, so two
     of these are briefly in flight: the one being cut off resolves through
     stopAdviserAudio and would otherwise land its finally AFTER the answer
     started, clearing `speaking` and freezing the mouth for the whole reply.
     Only the newest utterance may say he's stopped. */
  const sayToken = useRef(0);
  /* THE SINGLE-UTTERANCE `say` IS GONE (2026-08-03). It claimed `sayToken` and
     flipped `speaking` exactly as sayTurn does, which is the two-claimants shape
     the token guard exists to arbitrate — desktop deleted its copy for the same
     reason. Its one caller was the claim spin, which is now a one-part turn and
     gets the camera handover free. */

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
   * ONE LINE, ROUTED TO WHICHEVER MOUTH THAT CHARACTER ACTUALLY HAS — the same
   * indirection PressSession keeps for Eugene, and for the same reason: WHERE a
   * character's lip-sync comes from is a property of the character, not of the
   * turn, so the callers stay ignorant of it.
   *
   * VIRGIL IS THIS SURFACE'S EXCEPTION. He is the only cast member with a live
   * SitePal player here, so his line goes through the portal, which speaks his
   * ElevenLabs voice AND moves his face. Everyone else has no player and takes
   * the analyser path, which is what their drawn mouths (or, for the seats,
   * their stills) are built on. speakVirgilLine falls back to that same path by
   * itself if his portal isn't up, so this branch is never a way to lose a line.
   */
  const speakLine = useCallback(async (voice, text, seat = null) => {
    if (voice === VIRGIL.voice) { await speakVirgilLine(text); return; }
    /* A SEAT WITH A PLAYER GOES THROUGH IT — same trade the cat makes, and for
       the same reason: engine 14 is its own ElevenLabs voice AND its lip-sync
       in one call, where the fallback is that voice over a still. Keyed on the
       SEAT rather than the voice code because the portal is per-character;
       speakSeatLine falls back by itself if the player never came up, so this
       branch can never lose a line. The pitcher is excluded by having no
       sitepal config — it has a rig with real viseme plates. */
    if (seat && seatHasPortal(seat)) { await speakSeatLine(seat, text); return; }
    await speakAdviserLine(voice, text);
  }, []);

  /* EVERY WAY A LINE CAN BE CUT OFF has to reach BOTH mouths. The portal is a
     separate mechanism from the <audio>/buffer path — stopAdviserAudio knows
     nothing about it — so a press landing while the cat is mid-sentence used to
     leave him talking underneath the answer. */
  const stopVoice = useCallback(() => {
    try { stopAdviserAudio(); } catch {}
    try { stopVirgilLine(); } catch {}
  }, []);

  /**
   * @param opts.onPart  index of each part AS IT STARTS — the opening reveals its
   *   lines in step with the voice rather than printing the block up front.
   * @param opts.dwell   (text) => ms floor per part, for the case where audio
   *   never arrives: speakAdviserLine resolves in milliseconds without an API
   *   key, and three un-held sentences are gone before they can be read. Voice is
   *   enrichment and never a gate, so anything timed off it needs a floor.
   * @param opts.onDone  fired ONLY when the chain finishes without being
   *   superseded — it sits inside the token guard for that reason. Used to hand
   *   the feed back to the pitcher after Virgil's line; a press mid-turn bumps
   *   the token, and yanking the camera off the seat that is about to report
   *   would undo the cut the press just made.
   *
   * Per-part `minMs` overrides `dwell` for one part alone. Virgil needs a floor
   * the claim spin does not: without an API key both resolve instantly, and the
   * feed would cut pitcher -> cat -> pitcher inside a frame.
   *
   * Per-part `leadMs` HOLDS SILENCE BEFORE a part, which is a different thing
   * from `minMs` and needed for a different reason. `minMs` pads the END of a
   * line so a beat can be read; `leadMs` is the gap between two speakers. The cat
   * came in on the pitcher's last syllable — "Virgil starts speaking too quickly
   * after pitchbot ends" (author, 2026-08-04) — which reads as an interruption
   * rather than as a second person considering what was just said. Nothing is
   * speaking during the hold, so `speakingAs` still names the PREVIOUS voice and
   * the room does not light him up until he actually opens his mouth.
   */
  const sayTurn = useCallback(async (parts, { onPart = null, dwell = null, onDone = null } = {}) => {
    const live = parts.filter((p) => p && p.text);
    if (!live.length) return;
    const token = ++sayToken.current;
    setSpeaking(true);
    try {
      for (let i = 0; i < live.length; i++) {
        const p = live[i];
        if (sayToken.current !== token) return;   // superseded — stop the chain
        // THE CAMERA CUTS BEFORE THE PAUSE, NOT AFTER (author, 2026-08-05: "i
        // saw the pitchbot appear for a few seconds, and then virgil pops up.
        // Then, a long pause, finally i hear virgil's voice but no sitepal
        // animation").
        //
        // These two lines used to sit BELOW the leadMs wait, and every symptom
        // in that report is that ordering: `seat` defaults to the pitcher, so
        // the bot held the screen for the whole 2.4s beat, Virgil cut in only as
        // the wait ended, and his SitePal portal did not begin booting until the
        // speakLine call immediately after — which is why the voice arrives late
        // and lands on a face that never animates.
        //
        // Moved above the wait, VIRGIL_BEAT_MS now buys what it was always
        // supposed to: the beat plays on the INCOMING speaker's face, which is
        // what "somebody having listened and then answered" looks like rather
        // than sounds like, and the portal gets those 2.4 seconds as a head
        // start instead of spending them on the wrong character.
        //
        // `seat` is optional and defaults to the pitcher, so the opening and the
        // claim spins need no change — only a press, or the cat, names somebody
        // else.
        setSpeakingAs(p.voice || VOICE);
        setOnCamera(p.seat || PITCHER);
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
        const startedAt = Date.now();
        try { await speakLine(p.voice || VOICE, p.text, p.seat); }
        catch { /* voice is enrichment, never a gate on play */ }
        const floor = p.minMs ?? (dwell ? dwell(p.text) : 0);
        if (floor) {
          const left = floor - (Date.now() - startedAt);
          if (left > 0) await new Promise((r) => setTimeout(r, left));
        }
      }
    } finally {
      if (sayToken.current === token) { setSpeaking(false); onDone?.(); }
    }
  }, [speakLine]);

  /* ---- it introduces itself ----
     No audio-stopping cleanup, deliberately: a natural finish leaves nothing
     playing, and the two early exits (SKIP, unmount) are handled by skipOpening
     and by the unmount effect below. One here would race the claim effect, which
     starts speaking in the same commit that `opened` flips. */
  /* ---- the cat briefs you first ----
     Virgil's house rules run before the bot says anything. Same three-state seam
     as the opening, same component, and gated so only one of the two can be
     speaking: this runs while `briefed` is false, the opening refuses to start
     until it is true. See PressSession for why the beat lives on the floor and
     why the first part carries a lead. */
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
    // `briefed` joins the guard — the bot waits for the cat. ?brief=off flips it
    // on mount, so that path reaches the opening on the first frame as before.
    if (!onFloor || !briefed || opened || !openingLines.length) return;
    let alive = true;
    (async () => {
      await sayTurn(openingLines.map((text) => ({ voice: VOICE, text })),
                    { onPart: (i) => { if (alive) setOpeningAt(i); }, dwell: readDwellMs });
      // STOPS AT THE GATE — `opened` is beginPitch's to flip. The effect guard is
      // still `opened`, so this cannot re-enter while the button is up.
      if (alive) setOpeningDone(true);
    })();
    return () => { alive = false; };
  }, [onFloor, briefed, opened, openingLines, sayTurn]);

  // Bumping the token supersedes the chain in flight; its `finally` then declines
  // to touch `speaking`, so this clears it by hand.
  //
  // SKIP CLEARS THE GATE TOO: it is already the player saying move on, and making
  // them say it twice is the impatience path answering itself.
  const skipOpening = useCallback(() => {
    sayToken.current++;
    stopVoice();
    setSpeaking(false);
    setOpeningDone(true);
    setOpened(true);
  }, []);

  // The handover. `opened` is what the claim effect below waits on, so the first
  // claim — and its audio — begins inside the click.
  const beginPitch = useCallback(() => setOpened(true), []);

  /* THE BRIEFING'S EXITS, mirroring PressSession exactly — one beat, one tempo,
     on both surfaces. Skipping counts as having seen it. */
  const skipBrief = useCallback(() => {
    sayToken.current++;
    stopVoice();
    setSpeaking(false);
    setBriefDone(true);
    setBriefed(true);
    markBriefingSeen();
  }, []);

  const beginBrief = useCallback(() => { setBriefed(true); markBriefingSeen(); }, []);

  // Replay, offered only while the opening column is still free to print in.
  const replayBrief = useCallback(() => {
    sayToken.current++;
    stopVoice();
    setSpeaking(false);
    setOpeningAt(-1); setOpeningDone(false);
    setBriefAt(-1); setBriefDone(false);
    setBriefMode("long");
    setBriefed(false);
  }, []);

  // `floorLive`, not `onFloor`: during the opening the pitcher already has the
  // mouth, and starting claim 1 underneath it would put two of ITS OWN utterances
  // in flight — the collision sayToken arbitrates, except here both are valid.
  /* ---- AND THEN THE CAT ----
     The pitcher makes the claim; Virgil reads the runway on it. That ORDER is
     the whole point: the agenda ("two more money questions after this one") is
     the input to the decision the claim has just posed, so it has to land after
     you have heard what you are deciding about, not over the top of it.

     THE TIP, NOT THE AGENDA (author, 2026-08-04). He used to say the agenda
     out loud — "One more question about the story after this one" — on the
     reasoning that only the never-off half should be spoken, and that voicing
     the tip would make the surface a tutorial reading itself aloud. In
     practice the spoken half was the one carrying no advice: a scheduling fact
     delivered in a cat's voice, at the one moment the player is deciding what
     to do. The tip is the line a cat on a trading desk would actually say, and
     it is the one that names what is wrong with what you just heard.

     It does not become a tutorial because of what the tip may CONTAIN: the
     shape of the argument, never whether the claim is true (§3). Reading that
     out is a character having a view, not the game explaining itself.

     SILENT WHEN THE TIPS ARE OFF, unchanged and now literal — the switch and
     the spoken line are the same half. "Virgil stops chiming in" is the
     design's own phrasing for it. His AGENDA text is untouched and still on
     screen for everyone, which is what §3 requires of it. */
  useEffect(() => {
    if (!floorLive || !claim) return;
    // A new claim starts with none of him said — otherwise claim 2 inherits
    // claim 1's level and his read is on screen before the bot opens his mouth,
    // which is the exact thing `reveal` exists to stop.
    setVirgilAt(0);
    sayTurn(
      [
        // THE FRAMING LINE FIRST, then the argument — see the long note at the
        // matching effect in PressSession. Both surfaces speak the claim the same
        // way or they drift on what the bot sounds like.
        { voice: VOICE, text: claim.lead },
        // AND THE CHECKABLE PART OUT LOUD — see the long note at the matching
        // effect in PressSession for why it was always the bot's line and why
        // the FACT tag still does the separating. Both surfaces speak the claim
        // the same way or they drift on what the bot sounds like.
        { voice: VOICE, text: claim.fact },
        { voice: VOICE, text: claim.spin },
        // leadMs: he lets the bot finish before he says his piece. Same number as
        // PressSession, from the same constant, for the same reason the tip is.
        { voice: VIRGIL.voice, text: tips ? virgil?.tip : "", seat: VIRGIL.id,
          leadMs: VIRGIL_BEAT_MS, minMs: 900 },
        // Then the controls. Same cat carrying on, so a short beat rather than
        // VIRGIL_BEAT_MS — see the matching note in PressSession.
        { voice: VIRGIL.voice, text: virgil?.nextMove, seat: VIRGIL.id,
          leadMs: 500, minMs: 700 },
      ],
      {
        // Back to the pitcher: the claim is his and it is what you read next.
        onDone: () => setOnCamera(PITCHER),
        // HIS TEXT ARRIVES WHEN HIS VOICE DOES — same levels and same indices as
        // PressSession; see the long note there. Parts 0-2 are the bot's, 3 is
        // his read, 4 the consequence.
        onPart: (i) => setVirgilAt(i >= 4 ? 2 : i >= 3 ? 1 : 0),
      },
    );
    return () => { stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorLive, run.claimIndex]);

  useEffect(() => () => { stopVoice(); }, []);

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
    stopVoice();

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
      /* THE WARM-UP OVERLAPS THE BEAT, it does not add to it. If the reporter's
         player is mounted but has not registered sayText yet, this gives it a
         moment — inside the same Promise.all that is already waiting on
         MIN_BEAT, so a portal that is nearly up costs nothing and one that
         never comes up costs at most the wait, after which speakSeatLine takes
         the voice-only path by itself. Insurance for a nearly-ready player, not
         a substitute for mounting it a claim early; see portalSeat. */
      (solo ? Promise.resolve() : warmSeatPortal(outcome.seat))
        .then(() => sayTurn([solo
          ? { voice: VOICE, text: outcome.barronSays, seat: PITCHER }
          : { voice: seatMeta(outcome.seat)?.voice, text: outcome.adviserSays,
              seat: outcome.seat }])),
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
        // THE BADGE NEEDS NO OWNER TEST ANY MORE. It briefly had one, because
        // the tab was permanently the bot's deck and a receipt Marisol produced
        // would have had the seller taking credit for the desk's finding in the
        // status line. The tab follows the camera now and the camera is holding
        // on whoever just reported, so the screen the badge describes is always
        // the screen the receipt is on.
        setHasRecord(!!outcome.receipt);
        setFlash((f) => (f && f.id === owed ? { ...f, stage: "choice" } : f));
        /* IT COMES TO YOU (author, 2026-08-05: "make the evidence screen more
           accessible or float it up automatically and let player dismiss/close
           it").

           A press is the most expensive thing the player does, and the finding
           it buys was two taps away behind a pane the strip does not make
           obvious — so the receipt, which is the whole return on the spend, was
           the easiest thing in the game to miss entirely.

           THE DEFERRED REVEAL IS INTACT, and it is worth being exact about why,
           because it is doctrine (pressUi's header: "nothing naming the outcome
           until you have gone and looked"). That rule is about TEXT naming a
           verdict the player has not seen. Switching the pane does not name
           anything — it IS the looking, performed for you. `looked` is set here
           for the same reason: the beat genuinely has been satisfied, and
           leaving it false would keep pulsing LOOK at a board already on screen.

           ONLY WHEN THERE IS SOMETHING TO SEE. No receipt means the board would
           come up empty, which teaches the player that floating up means
           nothing. Those answers leave the old pulse behind instead.

           THE STRIP IS THE DISMISS. It is already a two-tab control the player
           has been using all session; adding a close button would be a third
           way to do what FEED does. */
        if (outcome.receipt) {
          setPane("screen");
          setLookPending(false);
          setFlash((f) => (f && f.id === owed ? { ...f, looked: true } : f));
        } else {
          // Already sitting on the pane the answer landed on? Then you watched it
          // land and there's nothing to send you anywhere. Which pane that is now
          // depends on WHO answered, so the check has to as well.
          setLookPending(paneRef.current !== "screen");
        }

        // AND THE CAT CLOSES THE BEAT — same moment, same rule, same bank as
        // PressSession. See afterAnswer in virgil.js; the two surfaces speak the
        // same three Virgil voices or they drift on what having a guide means.
        if (tips) {
          sayTurn([{
            voice: VIRGIL.voice, seat: VIRGIL.id,
            text: virgilAfterAnswer({ lastClaim, index: run.claimIndex }),
            leadMs: VIRGIL_BEAT_MS, minMs: 700,
          }]);
        }
      });
  }, [run, deal, claim, floorLive, sayTurn]);

  /* GO AND LOOK. One door, one destination, because the pane always shows the
     screen belonging to whoever is in frame — and the camera is already holding
     on the reporter by the time this is offered (see the note on onCamera). So
     the tab and this button do the same thing, which is the point: the player
     can arrive at the finding from the row that just produced it or from the
     channel strip, and both are the same move. */
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
    // ...which also takes the second tab back to PITCH DECK, since it follows
    // the camera. Nothing else to reset: screenOwner is derived, not stored.
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
            <p>One pitch. Three questions. Then say how much of it you believe.</p>
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
              sector={identity ? deal.sector : null}
              ref={recordRef} clientRef={clientRef}
              particularsRef={particularsRef}
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
            <div><b>03</b><span>QUESTIONS</span></div>
            <div><b>04</b><span>ANALYSTS</span></div>
            <div><b>01</b><span>FINAL CALL</span></div>
          </div>
          {/* THE HOUSE RULES, REWRITTEN 2026-08-03 (author: "let's just rewrite
              the whole section"). Two things were wrong with the old line.
              SEND WAS A DEAD VERB — [A§11] rejected it for the analysts
              because they never leave their desks ("that's why 'send' seems
              weird to me"), and [A§20] recorded it failing on the pitcher's
              side too; the row header has been ASK A FOLLOW-UP ever since,
              and this paragraph was the last place still teaching the word.
              AND IT LED WITH THE INCENTIVE, which is the second-most useful
              thing on the screen: the FIRST is that the bot's facts are true,
              because that is the whole shape of the puzzle (VC_GAME §1 —
              "Every fact stated is true. What you judge is the inference sold
              on top of it") and the briefing had never said it anywhere. */}
          {/* KEPT IDENTICAL TO .ps-directive (author, 2026-08-05) — the two
              surfaces carry the same words and are edited together; see the note
              at the same paragraph there. The tail was "make the final call"
              here and "decide whether it deserves funding" on the panel, which
              had already drifted apart before this. Both are now the author's
              fund-it-or-FUD-it line: it names the two outcomes in the player's
              own vocabulary and makes the verdict a choice between two acts
              rather than a rating. */}
          <p className="pf-directive">
            Every fact the pitch bot states is true...technically. But is the
            project viable? Consult with the team and decide whether to fund it
            or FUD it.
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
      {/* THE FLOOR CARRIES ITS OWN BEAT ON THE CLASS, because two rows of it are
          conditional and the stage is the only child that can spend the slack.
          `opening` — no agenda, no dock, and ~450px of nothing under two lines
          of speech; the bot introducing itself is what that space is for.
          `on-screen` — you have gone to look at a board, so the board is the
          content and a 30vh stage renders the receipt at 72x44. Both are pure
          sizing: nothing keyed to either says anything about the deal. */}
      {onFloor && claim && (
        <div className={`pf-floor${floorLive ? "" : " opening"}${pane !== "feed" ? " on-screen" : ""}`}>
          <div className="pf-tabs">
            {/* NAMED FROM THE DESK, not typed in — and now named after WHOEVER
                THE FEED IS ON, which is the same fix twice over. It said BARRON,
                left over from when he did the selling, so the tab back to the
                PITCHER carried an ANALYST's name two rows above a seat row where
                that analyst is one of the four you can send. Hard-coding the
                pitcher instead would have reintroduced the same lie the moment
                the feed started cutting to the reporter. */}
            {/* THE CAT IS NOT IN THE DESK, so seatMeta answers null for him and
                the fallback would have put the PITCHER's name over the cat's
                face — the same wrong-name-over-a-live-feed bug this tab was
                fixed for, arriving from the one direction seatMeta cannot cover.
                He is deliberately absent from DESK (virgil.js: not staff, not a
                seat) and pressRun must never import him, so he is resolved HERE
                rather than by widening that lookup. */}
            {/* TWO LINES BY DESIGN, not by accident. These were one line with the
                status inline, which fits "PITCH BOT" and nothing else: at 347px
                each tab is ~150px and "DETECTIVE MARISOL · speaking" wants 200,
                so it broke wherever the words ran out — "◉ PITCH BOT ·" over
                "speaking", the two tabs at different heights. The name is the
                channel and the status is the readout under it; both are fixed
                rows now, the name truncates rather than wrapping, and the tab
                bar keeps one height whoever the camera is on. */}
            <button className={pane === "feed" ? "on" : ""} onClick={() => setPane("feed")}>
              <span className="pf-tab-name">
                ◉ {(onCamera === VIRGIL.id
                      ? VIRGIL.name
                      : seatMeta(onCamera)?.name || PITCH_BOT.name).toUpperCase()}
              </span>
              {/* LIVE is the panel's own word for its rest state (PressFigure
                  prints "· LIVE" on the plate), so the row reads as a channel
                  strip rather than going blank between utterances. */}
              <em>{speaking ? "speaking" : "live"}</em>
            </button>
            {/* THE BADGE MAY NOT ANSWER THE QUESTION THE BOARD IS THERE TO
                ANSWER. While the look is pending it says only that there IS
                something — "ON RECORD" here would hand you the outcome from
                the tab bar and make going to look pointless. */}
            {/* ONE TAB, ONE MEANING: THE SCREEN OF WHOEVER IS IN FRAME (author,
                2026-08-04). It is the bot's PITCH DECK while the bot has the
                floor and an analyst's SCREEN while they do, because that is the
                same sentence either way — and it is why the first tab went back
                to being only a face.

                Two earlier shapes were both worse. ITS SCREEN named the pitcher
                over a switcher holding four boards with four owners. Splitting
                them into a permanent deck tab plus a tabless analyst pane fixed
                the lie but bought a second pulse location, a tab that could
                read as selected while neither pane was, and a first tab doing
                two jobs. Binding the tab to the camera collapses all of it: one
                owner at a time, so one name, one badge and one pulse.

                THE BADGE STILL MAY NOT ANSWER THE QUESTION THE SCREEN IS THERE
                TO ANSWER. While the look is pending it says only that there IS
                something — "ON RECORD" here would hand you the outcome from the
                tab bar and make going to look pointless. */}
            <button className={`${pane === "screen" ? "on" : ""}${lookPending ? " look" : ""}`}
                    onClick={lookAtScreen}>
              <span className="pf-tab-name">
                {screenOwner === PITCHER ? "▦ PITCH DECK" : "▤ SCREEN"}
              </span>
              <em className={lookPending ? "" : hasRecord ? "rec" : ""}>
                {lookPending ? "LOOK"
                  : hasRecord ? "ON RECORD"
                  : screenOwner === PITCHER ? "the pitch" : "no record"}
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
                           who={onCamera} band={mood.band}
                           portalSeat={portalSeat} />
            </div>
            {/* ONE SCREEN PANE, SHOWING WHOEVER IS IN FRAME. All four canvases
                stay mounted — they are painted by a timer that has to keep
                running whether or not you are looking, so a receipt is already
                on the glass when you arrive rather than drawing itself while
                you watch — and exactly one is displayed. Which one is
                `screenOwner`, derived from the camera, so the tab's name and
                the panel under it cannot disagree. */}
            <div className={`pf-pane wide ${pane === "screen" ? "show" : ""}`}>
              <div className="pf-boards">
                {BOARDS.map((seat) => (
                  <div key={seat} className={`pf-screen ${screenOwner === seat ? "show" : ""}`}>
                    <canvas id={`pf-screen-${seat}`} width={512} height={320} />
                  </div>
                ))}
              </div>
            </div>
            {/* THE FOUR-WAY CHIP STRIP IS GONE (author, 2026-08-04: "potentially
                confusing"). It was a switcher across the pitcher's board and
                three analysts', and three of its four chips read "—" for most
                of a session: a permanent comparison UI for boards that mostly
                have nothing on them, sitting where the one board you had just
                paid a specialist for should have been. Each board now appears
                in the one place it means something. Do not reintroduce a
                switcher here — if a second board ever needs reaching, it
                belongs next to the seat that owns it. */}
          </div>

          {/* THE AGENDA RAIL IS GONE FROM THIS SURFACE (author, 2026-08-04:
              "there's a whole row of tabs at the bottom... I don't think we
              need the tabs and should remove them").

              WHAT IT WAS FOR, AND WHAT NOW CARRIES IT. Its job was the one §3
              names: "without it, holding an adviser back is a blind bet". But
              the decision it informs is only ever about the CLAIM IN FRONT OF
              YOU — whether this one is worth the specialist who owns its lane —
              and Virgil now states exactly that, in words, on every claim:
              "One more question about the story after this one. Eugene will
              keep, if you'd rather wait." That line did not exist when the rail
              was built; it does the rail's work and names the consequence,
              which the rail never did.

              WHAT IS ACTUALLY LOST is the full six-subject map, and on a phone
              it was mostly lost anyway: three chips of six fit, the rest sat
              behind a horizontal scroll nobody discovers, and the progress it
              also showed is in the claim header's "1 / 6".

              DESKTOP KEEPS ITS OWN. This is PressFlat's rail only — do not read
              this as the mechanic being cut. If it ever comes back here it
              should come back as something you open, not as a fourth pinned
              row on a surface with a documented height contract. */}

          {/* THE ONLY THING ON THE FLOOR THAT SCROLLS. Tabs, feed and dock are
              all pinned, so the way out of a claim is never further than a
              thumb. This region exists because it didn't: the floor was five
              flex:none rows in an overflow:hidden column, so on any viewport
              under ~900px tall the dock simply ran off the bottom and LET HIM
              GO ON / CALL IT were clipped away — measured at 839px in a 700px
              box. The pitch had no exit. */}
          <div className={`pf-read${more ? " more" : ""}`} ref={readRef}>
            {/* THE ANSWER TAKES THE COLUMN (author, 2026-08-04: "here's where it
                gets a bit too dense... when the character is up, we just show
                the box that has the character's transcript and the 2 buttons").

                While a report is live the column carried NINE blocks at once —
                the tail of the spin, the FACT, the lane band, Virgil's agenda,
                Virgil's tip, then the answer, and the dock's three rows under
                all of it. The two buttons the beat exists for were the last
                thing on a scroller, below everything already read, at the exact
                moment there is a decision to make.

                So the claim body stands down for the length of the answer. It
                is not information withdrawn: every line of it was on screen
                thirty seconds ago, and it returns the moment the claim moves
                on. What replaces it is the one thing that is new. */}
            {opened ? (
              answering ? null : (
                <ClaimBody claim={claim} virgil={virgil} onToggleTips={() => setTips((t) => !t)}
                           pressure={mood} aside={aside}
                           spent={run.advisersSpent}
                           count={`${run.claimIndex + 1} / ${deal.claims.length}`}
                           remaining={outlook.remaining} earlier={outlook.earlier}
                           reveal={virgilAt} />
              )
            ) : !briefed ? (
              /* THE CAT FIRST, and unquoted — he is talking to you rather than
                 being quoted at you. Same component as the bot's remarks so the
                 two beats cannot drift on reveal, skip or gate. */
              <>
                <OpeningBody lines={briefLines} at={briefAt} onSkip={skipBrief}
                             done={briefDone}
                             onBegin={briefDone ? beginBrief : null}
                             who={VIRGIL.name} kicker="— the house rules"
                             skipLabel="SKIP THE RULES ▸"
                             beginLabel="◉ READY — BRING IN THE PITCH BOT ▸"
                             cue="▼ PRESS THIS TO START THE PITCH"
                             quoted={false} subtitle />
              </>
            ) : (
              <>
                <OpeningBody lines={openingLines} at={openingAt} onSkip={skipOpening}
                             done={openingDone}
                             onBegin={openingDone ? beginPitch : null} />
                {/* Quiet by design — see the matching control on PressSession. */}
                <button type="button" className="pf-rules" onClick={replayBrief}>
                  run the rules again
                </button>
              </>
            )}

            {answering && (
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

            {/* THE ROW APPEARS WHEN IT IS TIME TO CHOOSE, AND NOT BEFORE
                (author, 2026-08-04: "only show the character buttons when it
                is time to pick a character to consult or to call the deal").

                Three states, and the row belongs to exactly one of them:
                  SOMEBODY IS TALKING — you are listening, and the five tiles
                    are ~100px of the pinned dock inviting a decision the beat
                    has not reached. This is most of a claim's runtime.
                  NOBODY IS TALKING, A PRESS IS LEGAL — now. This is the
                    decision the game is about, and it gets the dock to itself.
                  A REPORT IS UP — the two moves that matter are already in the
                    answer box, and `live` is false here anyway, so the row was
                    rendering its spent-state line: a second, quieter way of
                    saying what the panel above it had just said.

                `speaking` covers the bot and Virgil both, so the row also stays
                away while the cat reads the agenda — which is exactly when a
                player is being told what the choice is FOR.
                COMPACT, because this dock is pinned and the reading column is
                what pays for anything added to it; see SeatRow's own note. */}
            {!speaking && !answering && (
              <SeatRow run={run} live={live} pressed={pressed} options={options}
                       onPress={press} compact />
            )}

            <Nav lastClaim={lastClaim} pressed={pressed} onAdvance={advance} onCallIt={callIt} />
          </div>
          )}
        </div>
      )}

      {/* ---------- the call ---------- */}
      {run.phase === PHASE.ALLOCATION && (
        <div className="pf-scroll center">
          <div className="pf-label">YOUR CALL — {deal.ticker}</div>
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
          <div className="pf-saying">{readout.saying}</div>
          <div className="pf-risk">{readout.risk}</div>
          <button className="pf-btn primary" onClick={lockCall}>LOCK IT IN</button>
        </div>
      )}

      {/* ---------- resolution ---------- */}
      {run.phase === PHASE.RESOLUTION && (
        <div className="pf-scroll center">
          {/* FOUR BANDS, NOT A SIGN TEST — see callVerdict in pressRun.js. The
              old headline keyed on `pnl >= 0`, which is |p - truth| <= 0.5: a
              hit rate, and one that congratulated a dead-centre PASS for
              reading a rug correctly. */}
          <div className={`pf-pnl ${verdict ? verdict.tone : "up"}`}>
            {run.call.pnl > 0 ? "+" : ""}{Math.round(run.call.pnl)}
          </div>
          <div className="pf-label">{verdict ? verdict.label : ""}</div>
          {/* THE BET, BEFORE THE STORY. What the player committed to, in their
              own stated conviction, next to what it was worth — then the deal's
              own account of what happened, then the settlement note. */}
          {betRestated(run, deal) && (
            <p className="pf-copy gold">{betRestated(run, deal)}</p>
          )}
          <p className="pf-copy">{deal.resolution}</p>
          {/* THE GAP, SAID OUT LOUD (§7 item 7). Only ever renders when the
              claims held and the venture died anyway — the one combination
              where the payout above disagrees with the sentence above it, and
              the header is showing YOU READ IT RIGHT over a corpse. Smoothing
              that over would mean coupling the score to the outcome, which is
              invariant 2 through the back door, so it is narrated instead. */}
          {settlementNote(run, deal) && (
            <p className="pf-copy note">{settlementNote(run, deal)}</p>
          )}
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
          {/* THE TELL IS THE HEADLINE NOW (author, 2026-08-05: "the post-game
              analysis was too detailed and small font makes it hard to read").
              It was set SMALLER than the pattern name above it, inside a nested
              box — which had the emphasis exactly inverted. The pattern name is
              a filing label; the tell is the one sentence that survives the
              token and the only thing here a player carries to the next deal.
              So the tell takes the large type and the label becomes its kicker.
              Nothing was deleted from this block — it was re-ranked. */}
          <div className="pf-pattern">
            <div className="pf-label">THE PATTERN</div>
            <div className="pf-pattern-kicker">
              {deal.archetypeLabel} — {deal.name} was one of these.
            </div>
            {deal.archetypeTell && <p className="pf-tell">{deal.archetypeTell}</p>}
            <p className="pf-copy sm dim">
              Same shape, different token. Learn it and you get every one of these.
            </p>
          </div>

          {/* THE AUDIT, CUT TO WHAT THE PLAYER BOUGHT. Six claims each with a
              verdict was the bulk that made this screen unreadable, and most of
              it is confirmation the player never asked for. The claims they
              PRESSED lead; the rest stay one tap away, so the audit is still
              complete and the screen is no longer a wall.
              It also settles a tension worth naming: the autopsy adjudicates
              every claim whether or not you pressed it, so pressing bought
              timing rather than access. Making the pressed ones the default view
              is the smallest honest way to pay the press back.
              <details>, not React state — native disclosure, keyboard and screen
              reader support for free, and no new state on a component that
              already holds a run. Open by default when nothing was pressed,
              because a collapsed section is not an audit. */}
          {(() => {
            const pressed = deal.claims.filter((c) => run.outcomes[c.id]);
            const rest = deal.claims.filter((c) => !run.outcomes[c.id]);
            const row = (c) => (
              <div key={c.id} className={`pf-au ${run.outcomes[c.id] ? "pressed" : ""}`}>
                <div className="pf-au-fact">{c.fact}</div>
                <div className="pf-au-verdict">{deal.autopsy[c.id]}</div>
              </div>
            );
            return (
              <>
                {pressed.map(row)}
                {rest.length > 0 && (
                  <details className="pf-au-rest" open={pressed.length === 0}>
                    <summary>
                      {pressed.length === 0
                        ? `ALL ${rest.length} CLAIMS`
                        : `THE OTHER ${rest.length} YOU DIDN'T ASK ABOUT`}
                    </summary>
                    {rest.map(row)}
                  </details>
                )}
              </>
            );
          })()}
          <button className="pf-btn primary" onClick={onExit}>BACK TO THE DESK</button>
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
  /* THE COLUMN IS A QUERY CONTAINER so the stage can be sized against ITS OWN
     WIDTH rather than the viewport's — see .pf-stage. On a phone the two are
     the same number, but on ?flat=1 the column is 520px inside a 1400px window
     and a vw-based square would be four times too tall. */
  container-type:inline-size;
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
/* THE APP CENTRES EVERY PARAGRAPH. globals.css carries a bare p{text-align:
   center} from the site's first theme, so a <p> on this surface is centred
   wherever it lands — the ten-line RESOLUTION, the briefing's house rules, and
   THE TELL sitting in a left-aligned box under a left-aligned label. Inherit
   puts each paragraph back under whatever its own container decided, which
   leaves the two screens below centred on purpose and everything else left. */
.pf-wrap p { text-align:inherit; }

/* THE SECOND justify-content IS A FALLBACK PAIR, NOT A TYPO. A flex box
   centred on content taller than itself overflows in BOTH directions, and the
   scroll origin is the top edge, so the first lines of a long resolution
   become unreachable on a short viewport. The safe keyword degrades to
   flex-start exactly when that would happen; the plain one above it is what
   anything that drops the safe declaration is left with. */
.pf-scroll.center { display:flex; flex-direction:column;
  justify-content:center; justify-content:safe center; text-align:center; }
/* CENTRED BOX, LEFT-ALIGNED PROSE. The number, its verdict line and the call's
   controls are single objects and read fine centred; a full paragraph does not
   — a resolution runs ten lines on a phone, and centring both its edges is the
   least readable shape available for it. The note already did this alone,
   which is what made the two paragraphs on that screen disagree. */
.pf-scroll.center .pf-copy { text-align:left; }
.pf-label { margin:10px 0 7px; color:#2fd6d6; font-size:10px; letter-spacing:.16em; }
/* Quiet on purpose: a player who wants the house rules again will go looking,
   and one who doesn't should not be nudged into restarting a ~50s beat. */
.pf-rules { display:block; margin:9px auto 0; padding:3px 8px;
  font:10px/1.3 'Courier New',monospace; letter-spacing:.06em;
  color:rgba(200,229,223,.5); background:none; cursor:pointer;
  border:1px solid rgba(200,229,223,.2); border-radius:3px; }
.pf-rules:hover { color:#c8e5df; border-color:rgba(200,229,223,.45); }
.pf-copy { margin:8px 0; color:#c8e5df; font-size:12px; line-height:1.48; }
.pf-copy.sm { font-size:10.5px; }
.pf-copy.dim { color:rgba(200,229,223,.58); }
.pf-copy.gold { color:#ffd23a; }
/* THE SETTLEMENT NOTE (§7 item 7) — see the desktop rule. Commentary, not
   evidence, so it is dimmer and ruled off rather than coloured; gold on this
   surface means a receipt. */
.pf-copy.note { font-size:11px; line-height:1.45; margin-top:10px; padding-top:9px;
  border-top:1px solid rgba(200,229,223,.2);
  color:rgba(200,229,223,.62); font-style:italic; text-align:left; }

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
/* ONE COLUMN ON A PHONE. The form reserves the polaroid's width down its right
   edge, so on a ~347px column the two stat columns are ~75px each and a 45px
   label leaves 22px for the value: AGE printed "52" over "days", which then
   shunted SOCIAL out of line with 24H. Queried against .eng-file, which is
   already the inline-size container --badge-w is measured from — the record is
   also 520px wide on ?flat=1 and two columns are right there. */
@container (max-width: 360px) {
  .pf-start .eng-stats { grid-template-columns:1fr; }
  .pf-start .eng-part-h { letter-spacing:.12em; }
}
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

/* SQUARE, SO THE CHARACTER FILLS IT (author, 2026-08-04: "let's fill the whole
   box with the pitchbot/character, instead of a box within a box").

   The box-in-box was a shape mismatch, not a margin: .pf-feed is aspect-ratio
   1/1 sized off this element's HEIGHT, so a 343x225 landscape stage rendered a
   225px square with 59px of dead gradient down each side. Making the FEED fill
   a landscape stage is the wrong repair twice over — cover-cropping a square
   portrait to 1.5:1 cuts a third of its height, which is the character's head,
   and .pf-mouth is positioned in percentages of the panel, so a changed aspect
   silently drifts the drawn mouth off the face it patches.

   So the STAGE takes the feed's shape instead. 100cqw is the column's own
   width, which is what makes the square exactly fill it; the dvh cap is what
   stops it eating the reading column on a short viewport, and the padding is
   gone because 10px of it was 10px the square could not use.
   flex:0 1 auto still lets it give up height before the words do.
   (NO BACKTICKS IN THIS STRING — see the note under .pf-screen.) */
/* THE dvh CAP IS THE OTHER WAY TO LOSE THE SQUARE, and it is worth being
   explicit about which is which. 100cqw is the width the character has to fill;
   the cap only exists so a very short viewport does not hand half the screen to
   a portrait. Whenever the cap WINS, the stage is shorter than the column and
   the inset returns by definition — so it is set high enough that it binds only
   where it should. At 52dvh a 390x844 phone resolves min(390, 439) = 390 and
   fills; a 600px-tall window resolves the cap and takes the margins, which at
   that height is the right trade. */
.pf-stage { flex:0 1 auto;
  height:30vh;
  height:min(100cqw, 52dvh);
  min-height:140px; max-height:420px; padding:0;
  display:flex; justify-content:center; align-items:center; overflow:hidden;
  background:radial-gradient(ellipse at 50% 35%, rgba(255,45,111,0.14), transparent 68%); }
.pf-stage > * { height:100%; }

/* THE TWO BEATS THAT RESIZE THE STAGE. Both stay a DEFINITE height (a vh, never
   auto) and that is load-bearing, not tidiness: the receipt canvas is an
   absolutely positioned child sizing itself with max-height:100%, so the moment
   an ancestor goes indefinite the percentage falls back to auto and the board
   collapses — the same failure the note under .pf-screen records twice.

   OPENING — the agenda and the dock are both absent while the bot introduces
   itself, which left two lines of speech at the top of a ~450px void. The bot
   is what the beat is about, so the stage takes the slack rather than the empty
   reading column.

   ON-SCREEN — you spent a move to go and look, so the board is the content. At
   30vh, shared with the chip strip, the receipt drew at 72x44 CSS px: the one
   panel whose emptiness is the product, too small to read either way. */
/* dvh, WITH vh UNDERNEATH IT. The container these live in is MobileTerminalGame's
   100dvh overlay, and on iOS Safari vh is the LARGE viewport — the one you get
   with the toolbar hidden — so a vh fraction is a bigger share of the box than
   it reads as whenever the toolbar is up. The vh line is the fallback for
   anything that drops the dvh one; the base .pf-stage rule keeps its own vh. */
.pf-floor.opening .pf-stage { height:46vh; height:46dvh; max-height:420px; }
.pf-floor.on-screen .pf-stage { height:44vh; height:44dvh;
  min-height:min(200px, 30vh); min-height:min(200px, 30dvh); max-height:400px; }
/* The board pane used to need its own shrink weighting here — asking for 44vh
   got 180px back, because flex distributes shrink by base size and the taller
   box loses the most. That weighting is on .pf-read for EVERY beat now (see
   its rule), for the same reason arrived at from the other direction: the
   square stage stops being square the moment anything squeezes it. */

/* THE COLUMN YIELDS BEFORE THE STAGE DOES, and that is what keeps the square
   square. flex:0 1 auto on the stage means a long claim can shrink it, and a
   shrunken square stops filling the column's width — so the character was
   full-width on some claims and inset by 60px a side on others, varying with
   how much the bot happened to say (author, 2026-08-04: "sometimes the
   character screen is not full-width").

   shrink:100 does not make the stage rigid — that would be the dock-overflow
   bug again, and the dock is flex:none so anything unshrinkable here is height
   the floor has to find under the clip edge. It makes this column absorb
   essentially all of it FIRST, down to its own 76px floor, after which the
   stage resumes shrinking normally. This column is the only thing on the floor
   that scrolls, so height taken from it is deferred rather than lost. */
.pf-read { flex:1 1 auto; flex-shrink:100; min-height:76px;
  overflow-y:auto; overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch; padding-bottom:8px; }
/* only while something IS below — so the last line is never the faded one */
.pf-read.more { -webkit-mask-image:linear-gradient(180deg, #000 calc(100% - 24px), transparent);
  mask-image:linear-gradient(180deg, #000 calc(100% - 24px), transparent); }

/* .pf-agenda AND .pf-ag ARE GONE WITH THE RAIL THEY STYLED — see the render
   site for what replaced its job. Deleted rather than left dangling: an orphan
   ruleset for markup no caller renders is how .pf-look outlived its button.
   The LANE DOT COLOURS lived here and are not lost — the same four are on
   .pu-virgil-lane in pressUi, which is where the lane is named now. */

/* THE BOARD COLUMN: one panel, then the strip that switches between them. It
   takes the stage's whole height so the panel can be sized against something
   definite — see the canvas note below. min-height:0 because a flex item's
   default min-height:auto would let the canvas push the strip out of the
   clipped stage rather than shrink. */
.pf-boards { width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:7px; }
/* .pf-bstrip AND .pf-bchip ARE GONE WITH THE SWITCHER THEY STYLED. They were
   the four-way chip row across the pitcher's board and three analysts'; each
   board now appears in the one place it belongs, so there is nothing to switch
   between. Deleted rather than left dangling — an orphan rule for a control no
   caller renders is how .pf-look survived a rewrite of the beat it belonged to.
   The board pane keeps ONE child now, so .pf-boards' gap has nothing to space;
   it is harmless and stays, because the deck pane uses the same container. */

.pf-tabs { flex:none; display:flex; gap:1px; margin:0 12px; }
/* NAME OVER STATUS, two fixed rows — see the render site. The name row
   truncates instead of wrapping, so the tallest analyst name on the desk
   cannot change the height of the bar the floor is measured against. */
.pf-tabs button { flex:1; min-width:0; background:rgba(2,16,14,0.9);
  border:1px solid rgba(47,214,214,0.22);
  border-bottom:none; color:rgba(234,255,249,0.5); font:bold 9.5px/1.15 'Courier New',monospace;
  letter-spacing:0.11em; padding:7px 6px; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:2px; }
.pf-tab-name { display:block; max-width:100%; min-width:0;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pf-tabs button.on { color:#2fd6d6; border-color:rgba(47,214,214,0.5);
  background:rgba(47,214,214,0.08); }
.pf-tabs em { font-style:normal; font-weight:normal; opacity:0.7;
  font-size:8px; letter-spacing:0.09em; }
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
/* .pf-dock .pu-seats IS DELIBERATELY UNSTYLED FROM HERE. It used to carry
   flex-wrap:wrap, and that is what broke the height contract: five 104px tiles
   in a ~323px dock is three rows, 403px of seats, a 511px dock, and the nav
   off the bottom of the phone. The row is a GRID on this surface now — see
   SeatRow's compact prop, styled once in pressUi with everything else the two
   surfaces share. Nothing about it belongs back here. */

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
/* THE ONLY BUTTON WITHOUT CLEARANCE was the primary one. On the call and the
   resolution it is a direct sibling of the last line of copy and sat flush
   against it, so LOCK IT IN cropped the risk line and WHAT WAS ACTUALLY SAID
   cropped the settlement note. The sticky briefing CTA supplies its own
   spacing through .pf-cta-row and must not be given a second helping. */
.pf-scroll > .pf-btn.primary { margin-top:16px; }
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

/* THE ONE CONTROL THE WHOLE SESSION IS FOR, and at its native height it is a
   ~16px target under a thumb — on a phone that is a drag you have to aim at.
   Height on the input widens the hit area without taking over the rendering:
   accent-color still paints it, so the track stays thin and centred and the
   knob is the platform's own. */
.pf-slider { width:100%; max-width:420px; accent-color:#ff2d6f;
  height:40px; margin:0; }
.pf-ends { display:flex; justify-content:space-between; width:100%; max-width:420px;
  font-size:9px; letter-spacing:0.11em; color:rgba(234,255,249,0.5); margin-top:4px; }
.pf-saying { font-size:15px; line-height:1.4; margin-top:16px; }
/* line-height, because a 12px box around 12px type clips the descenders of the
   one line on this screen that names what you stand to lose. */
.pf-risk { font-size:12px; line-height:1.4; color:#ffd23a; margin-top:7px; }
.pf-pnl { font-size:52px; font-weight:bold; }
.pf-pnl.up { color:#4dffaa; text-shadow:0 0 24px rgba(77,255,170,0.5); }
.pf-pnl.down { color:#ff5f6f; text-shadow:0 0 24px rgba(255,95,111,0.5); }
/* THE ABSTAIN IS NEITHER. A pass scores exactly 0 and used to render green
   under "YOU READ IT RIGHT"; it gets its own neutral tone so the colour stops
   claiming a result the player declined to have. */
.pf-pnl.flat { color:rgba(234,255,249,0.55); text-shadow:none; }

.pf-scores { display:flex; gap:24px; margin:4px 0 12px; }
.pf-scores em { font-style:normal; font-size:9px; letter-spacing:0.12em; display:block;
  color:rgba(234,255,249,0.5); }
.pf-scores b { font-size:22px; color:#ffd23a; }
.pf-pattern { margin:8px 0 16px; padding:11px;
  background:rgba(255,210,58,0.05); border:1px solid rgba(255,210,58,0.28); }
.pf-pattern .pf-label { margin-top:0; }
/* THE KICKER — the archetype name and this deal, folded into one small line.
   These were two stacked elements at 12px+ competing with the tell below them;
   as filing metadata they only need to be findable, not read first. */
.pf-pattern-kicker { font:bold 9px/1.5 'Courier New',monospace; letter-spacing:.1em;
  color:rgba(255,210,58,0.72); text-transform:uppercase; margin:3px 0 9px; }
/* THE TELL — the largest type on the screen, and the box is gone with the
   demotion. It was boxed to read as "the portable lesson"; at this size it
   reads that way on its own, and the border was one more thing competing for
   the eye on a screen the author called too detailed. */
.pf-tell {
  margin:0 0 10px; font-size:15px; line-height:1.5; color:#fff6dc;
  text-align:left;
}
.pf-au { border-left:2px solid rgba(234,255,249,0.16); padding:7px 0 7px 10px; margin-bottom:10px; }
.pf-au.pressed { border-left-color:#ffd23a; }
/* THE CLAIMS YOU DIDN'T ASK ABOUT. Collapsed by default — see the render site.
   The summary is a real control, so it gets a control's affordance and hit
   area; the rows inside inherit .pf-au untouched. */
.pf-au-rest { margin:2px 0 12px; }
.pf-au-rest > summary {
  cursor:pointer; list-style:none; padding:8px 0;
  font:bold 9px/1.4 'Courier New',monospace; letter-spacing:.14em;
  color:rgba(47,214,214,0.72);
}
.pf-au-rest > summary::-webkit-details-marker { display:none; }
.pf-au-rest > summary::before { content:"▸ "; }
.pf-au-rest[open] > summary::before { content:"▾ "; }
.pf-au-rest > summary:hover { color:#2fd6d6; }
/* Six of these stack into one wall of type on a phone, and the claim and its
   verdict were 1px apart in size and 3px apart on the page — so the eye had no
   way to tell "what it said" from "what it turned out to be" without reading
   both. The gap and the leading do that work; the colours were already right. */
/* BOTH UP A STEP, AND THE EMPHASIS FLIPPED. 12/11px was small enough that the
   author couldn't read the screen, and the brighter of the two was the CLAIM —
   but the claim is what the bot already said; the VERDICT is the payload and
   the only line that teaches. So the verdict gets the weight now, and the claim
   recedes to the quote it is. */
.pf-au-fact { font-size:12.5px; line-height:1.5; color:rgba(234,255,249,0.62); }
.pf-au-verdict { font-size:13px; line-height:1.5; color:#2fd6d6; margin-top:6px; }
`;
