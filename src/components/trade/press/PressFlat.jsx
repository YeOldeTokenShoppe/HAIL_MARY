"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, rollSeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, PITCHER, SEATS, SEAT_LANE, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, DESK_ORDER, PITCH_BOT, laneOwner, laneSentence, pitcherAside, seatMeta } from "@/game/terminal-traders/press/desk";
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
  ENGAGEMENT_CSS,
} from "./engagement";
import { createFlatEvidenceScreen } from "./evidenceScreen";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, SeatRow, Meter, Nav, PRESS_UI_CSS,
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
// Two things it does that the 3D view CAN'T:
//   • Barron SPEAKS. /api/counsel-voice + the amplitude mouth means any
//     generated line can be voiced. Desktop is stuck with banked SitePal clips.
//   • The evidence screen is literally the screen. On desktop "his monitor
//     stays black" is a texture across the room; here the panel IS a terminal.

// THE PITCHER'S VOICE, and the DEFAULT for anything sayTurn isn't given a voice
// for — the claim's spin, and the pitcher's reaction after a seat reports. Was
// "JB" while Connor did the selling; the pitch bot has its own ElevenLabs
// voice now (VOICES.PB in api/counsel-voice, override with
// ELEVENLABS_VOICE_PITCHBOT).
//
// The adviser half is NO LONGER silent: `sayTurn` voices the seat first in its
// own key, then the pitcher — see the TWO VOICES PER PRESS note below.
const VOICE = "PB";

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
  const recordRef = useRef(null);
  const shieldRef = useRef(null);
  const clientRef = useRef(null);
  const termsRef = useRef(null);
  const stampRetainedRef = useRef(null);
  const particularsRef = useRef(null);
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
  // THREE boards, not one. Barron's, Marisol's and GR80's — Eugene never
  // stamps anything, by design, so he has no board to keep. Only one is on
  // screen at a time; the strip below is how you move between them.
  // PITCHER, not Barron, holds the first tab now. Barron ALIASES onto it (see
  // the same note in PressSession): four monitors, four analysts, and the agent
  // is an outsider whose receipt belongs on the easel page once that is wired.
  // Eugene still stamps nothing here, by design.
  const BOARDS = useMemo(() => [PITCHER, SEATS.MARISOL, SEATS.GR80], []);
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
  const sayTurn = useCallback(async (parts) => {
    const live = parts.filter((p) => p && p.text);
    if (!live.length) return;
    const token = ++sayToken.current;
    setSpeaking(true);
    try {
      for (const p of live) {
        if (sayToken.current !== token) return;   // superseded — stop the chain
        try { await speakAdviserLine(p.voice || VOICE, p.text); }
        catch { /* voice is enrichment, never a gate on play */ }
      }
    } finally {
      if (sayToken.current === token) setSpeaking(false);
    }
  }, []);

  useEffect(() => {
    if (!onFloor || !claim) return;
    say(claim.spin);
    return () => { try { stopAdviserAudio(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFloor, run.claimIndex]);

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
    if (!onFloor) return;
    const next = doPress(run, deal, seat);
    if (next === run) return;   // illegal, spent, or out of budget — a no-op
    const outcome = next.outcomes[claim.id];
    setRun(next);
    // `revealed:false` — the verdict copy and the panel's colour are both
    // derived from data we have RIGHT NOW, so without this flag they render
    // the instant you press and describe a board that hasn't changed yet.
    // Subtitling his answer is fine; interpreting it before he's finished
    // saying it is not.
    setFlash({
      id: claim.id, backing: outcome.backing, revealed: false,
      seat: outcome.seat, board: outcome.board,
      nothingOnFile: outcome.nothingOnFile,
      adviserSays: outcome.adviserSays,
      line: outcome.barronSays,
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
      // Seat first in its own voice, then the pitcher reacting. The deferred
      // reveal waits on the WHOLE exchange, so the board still changes only once
      // the room has finished talking.
      sayTurn([
        { voice: seatMeta(outcome.seat)?.voice, text: outcome.adviserSays },
        { voice: VOICE, text: outcome.barronSays },
      ]),
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
        setFlash((f) => (f && f.id === owed ? { ...f, revealed: true } : f));
        // Already sitting on his screen? Then you watched it land and there's
        // nothing to send you anywhere.
        setLookPending(paneRef.current !== "screen");
      });
  }, [run, deal, claim, onFloor, say]);

  // The one door to his screen — going there is what marks the reveal seen.
  const lookAtScreen = useCallback(() => { setPane("screen"); setLookPending(false); }, []);

  const advance = useCallback(() => {
    revealFor.current = null;
    setFlash(null);
    setPane("feed");     // new claim, back to his face
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
        channel="THE VC GAME"
        mode="DEAL SIM"
        code={`BOOK ${Math.round(run.book)}`}
        accent="#ffd23a"
        active
        onBack={onExit}
      />

      {!started && (
        <div className="pf-market-rail" aria-label="Deal simulation status">
          <span><i>MANDATE</i>{identity ? deal.ticker : "PENDING"}</span>
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

          {/* THE RECORD. Picked fresh for this sitting; you can't ask for a
              different one without leaving and coming back. See engagement.jsx
              for the five props that held this slot before it, and why the sixth
              is paperwork rather than another machine. */}
          <div className="pf-record-shell">
            <div className="pf-record-readout">
              <span>DEAL INTAKE</span>
              <span>{identity ? "● BRIEF RELEASED" : "○ AWAITING REVIEW"}</span>
            </div>
            <EngagementRecord
              arrived={identity}
              title={identity ? "Deal Brief" : "Inbound Deal"}
              restStatus="AWAITING REVIEW"
              arrivedStatus="MEETING SET"
              stampLabel="Meeting Set"
              client={identity ? deal.name : null}
              surface={identity ? deal.surface : null}
              ticker={identity ? deal.ticker : null}
              chain={identity ? deal.chain : null}
              ref={recordRef} shieldRef={shieldRef} clientRef={clientRef}
              termsRef={termsRef} particularsRef={particularsRef}
              stampRetainedRef={stampRetainedRef} />
            {!identity && (
              <div className="pf-sealed-state" aria-label="Client details are sealed">
                <div className="pf-seal-code" aria-hidden="true">
                  <span>02</span>
                  <i />
                </div>
                <div className="pf-seal-copy">
                  <b>CLIENT // SEALED</b>
                  <span className="pf-seal-source">SOURCE // COMMISSIONED AGENT</span>
                  <span>Review the file to release terms and particulars.</span>
                  <div className="pf-seal-key" aria-hidden="true">
                    <i /><i /><i /><em>INBOUND FILE</em>
                  </div>
                </div>
              </div>
            )}
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
            <span>YOUR ANALYST DESK</span>
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
            <button className={pane === "feed" ? "on" : ""} onClick={() => setPane("feed")}>
              ◉ BARRON{speaking && <em> · speaking</em>}
            </button>
            {/* THE BADGE MAY NOT ANSWER THE QUESTION THE BOARD IS THERE TO
                ANSWER. While the look is pending it says only that there IS
                something — "ON RECORD" here would hand you the outcome from
                the tab bar and make going to look pointless. */}
            <button className={`${pane === "screen" ? "on" : ""}${lookPending ? " look" : ""}`}
                    onClick={lookAtScreen}>
              ▤ HIS SCREEN
              <em className={lookPending ? "" : hasRecord ? "rec" : ""}>
                {lookPending ? " · LOOK" : hasRecord ? " · ON RECORD" : " · no record"}
              </em>
            </button>
          </div>
          <div className="pf-stage">
            <div className={`pf-pane ${pane === "feed" ? "show" : ""}`}>
              <PressFigure speaking={speaking} />
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
          <div className="pf-agenda">
            {deal.claims.map((c, i) => (
              <span key={c.id}
                    className={`pf-ag ${i < run.claimIndex ? "past" : ""} ${i === run.claimIndex ? "now" : ""} ${run.outcomes[c.id] ? "done" : ""}`}
                    data-lane={c.lane}>
                {c.subject}
              </span>
            ))}
          </div>

          {/* THE ONLY THING ON THE FLOOR THAT SCROLLS. Tabs, feed and dock are
              all pinned, so the way out of a claim is never further than a
              thumb. This region exists because it didn't: the floor was five
              flex:none rows in an overflow:hidden column, so on any viewport
              under ~900px tall the dock simply ran off the bottom and LET HIM
              GO ON / CALL IT were clipped away — measured at 839px in a 700px
              box. The pitch had no exit. */}
          <div className={`pf-read${more ? " more" : ""}`} ref={readRef}>
            <ClaimBody claim={claim} virgil={virgil} onToggleTips={() => setTips((t) => !t)}
                       pressure={mood} aside={aside}
                       spent={run.advisersSpent}
                       count={`${run.claimIndex + 1} / ${deal.claims.length}`} />

            {flash && flash.id === claim.id && (
              /* The verdict — and the panel's COLOUR, which is a tell too — are
                 held back until he has finished, so every answer looks
                 identical while he's still talking. Once he stops, the LOOK
                 button takes the verdict's slot: the absence is something you
                 went and looked at, not something you were shown. */
              <AnswerBody flash={flash}>
                {lookPending ? (
                  <button className="pf-look" onClick={lookAtScreen}>
                    ▤ HE'S FINISHED — SEE WHAT LANDED ▸
                  </button>
                ) : null}
              </AnswerBody>
            )}
          </div>{/* /pf-read */}

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
          <button className="pf-btn primary" onClick={finish}>WHAT HE ACTUALLY SAID ▸</button>
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

.pf-record-shell {
  position:relative; padding:22px 8px 8px;
  border:1px solid rgba(47,214,214,.3);
  background:linear-gradient(145deg,#19211f,#08100f 34%,#020504 78%);
  box-shadow:0 9px 22px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.025);
  clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,11px 100%,0 calc(100% - 11px));
}
.pf-record-shell::before {
  content:""; position:absolute; inset:3px; pointer-events:none;
  border:1px solid rgba(255,210,58,.12);
}
.pf-record-readout {
  position:absolute; z-index:2; left:10px; right:10px; top:7px;
  display:flex; justify-content:space-between; gap:8px;
  color:#ffd23a; font-size:6.5px; letter-spacing:.15em;
}
.pf-record-readout span:last-child { color:#76aaa3; }

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

/* Before the meeting is accepted, this is a sealed mandate rather than an
   empty completed form. The real terms and particulars remain mounted for the
   arrival timeline, but leave the flow until identity is released. */
.pf-start .eng:not(.in) { min-height:122px; padding-bottom:7px; }
.pf-start .eng:not(.in) .eng-body {
  height:80px; align-items:center; padding-bottom:0;
}
.pf-start .eng:not(.in) .eng-terms,
.pf-start .eng:not(.in) .eng-particulars {
  position:absolute; width:1px; height:1px; opacity:0; visibility:hidden; overflow:hidden;
  pointer-events:none;
}
.pf-start .eng:not(.in) .eng-idents {
  position:absolute; width:1px; height:1px; opacity:0; visibility:hidden; overflow:hidden;
}
.pf-sealed-state {
  position:absolute; z-index:3; left:104px; right:17px; top:63px;
  display:flex; align-items:center; gap:10px; min-width:0;
  pointer-events:none;
}
.pf-seal-code {
  position:relative; flex:none; width:34px; height:44px;
  display:flex; align-items:center; justify-content:center;
  border:1px solid rgba(255,210,58,.3);
  color:#ffd23a; font-family:'Orbitron','IoskeleyMono',monospace;
  font-size:10px; letter-spacing:.08em;
  clip-path:polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,0 100%);
}
.pf-seal-code::after {
  content:""; position:absolute; inset:4px;
  border:1px solid rgba(239,98,220,.16);
}
.pf-seal-code i {
  position:absolute; left:7px; right:7px; bottom:7px; height:1px;
  background:#ef62dc; box-shadow:0 0 7px rgba(239,98,220,.5);
}
.pf-seal-copy { min-width:0; display:flex; flex-direction:column; gap:4px; }
.pf-seal-copy > b {
  color:#ef62dc; font-size:8px; letter-spacing:.15em;
  text-shadow:0 0 9px rgba(239,98,220,.25);
}
.pf-seal-copy > span {
  max-width:185px; color:#8db1aa; font-size:7.5px; line-height:1.35;
  letter-spacing:.035em;
}
.pf-seal-copy > .pf-seal-source {
  color:rgba(255,210,58,.62); font-size:6.2px; letter-spacing:.12em;
}
.pf-seal-key {
  display:flex; align-items:center; gap:3px; margin-top:2px; overflow:hidden;
}
.pf-seal-key i {
  flex:0 1 25px; height:2px;
  background:linear-gradient(90deg,rgba(255,210,58,.12),rgba(255,210,58,.7),rgba(255,210,58,.12));
  background-size:200% 100%;
  animation:pfSealScan 2.4s linear infinite;
}
.pf-seal-key i:nth-child(2) { flex-basis:15px; animation-delay:-.7s; }
.pf-seal-key i:nth-child(3) { flex-basis:8px; animation-delay:-1.3s; }
.pf-seal-key em {
  margin-left:3px; color:rgba(255,210,58,.55); font-style:normal;
  font-size:5.5px; letter-spacing:.12em; white-space:nowrap;
}
@keyframes pfSealScan {
  from { background-position:100% 0; }
  to { background-position:-100% 0; }
}

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
.pf-face-role { font-size:5.8px; letter-spacing:0.08em; color:rgba(255,210,58,0.75); }

/* VIRGIL, at the end of the strip and set apart from it on purpose — not a seat,
   no lane, cannot be sent. The divider carries that; don't tidy it away. */
.pf-face-div { display:none; }
.pf-face-cat .pf-face-pic { border-color:rgba(191,238,222,0.5); }
.pf-face-cat .pf-face-who { color:#bfeede; }
.pf-face-cat .pf-face-role { color:rgba(191,238,222,0.75); }
.pf-face-note { font-size:5.5px; letter-spacing:0.08em;
  color:rgba(191,238,222,0.5); margin-top:1px; }

/* The directive under his answer. Static — the tab does the attracting, and
   two things pulsing at once reads as an error state rather than a nudge. */
.pf-look { display:block; width:100%; margin-top:9px; cursor:pointer;
  background:rgba(47,214,214,0.10); border:1px solid rgba(47,214,214,0.55);
  color:#2fd6d6; font:bold 10px/1.2 'Courier New',monospace; letter-spacing:0.11em;
  padding:10px 8px; }
@media (prefers-reduced-motion:reduce) {
  .pf-seal-key i { animation:none; }
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
   is circular, so the percentage falls back to auto. Flex parent + height:100%
   resolves; aspect-ratio re-derives the height if max-width ever bites on a
   very tall stage. */
.pf-screen { display:flex; align-items:center; justify-content:center;
  width:100%; height:100%; }
.pf-screen canvas { display:block; height:100%; width:auto; max-width:100%;
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
