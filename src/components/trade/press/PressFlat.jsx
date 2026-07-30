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
  EnigmaConsole, runArrival, prefersReducedMotion, SFX, ARRIVAL_CSS,
} from "./arrival";
import { createFlatEvidenceScreen } from "./evidenceScreen";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, SeatRow, Meter, Nav, PRESS_UI_CSS,
} from "./pressUi";

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

// THE PITCHER'S VOICE. Both say() calls on this surface are the pitcher's own
// lines — the claim's spin, and its reaction after a seat reports — so one key
// covers them. Was "JB" while John Barron did the selling; the pitch bot has its
// own ElevenLabs voice now (VOICES.PB in api/counsel-voice, override with
// ELEVENLABS_VOICE_PITCHBOT).
//
// The ADVISER half of a press is still silent — `outcome.adviserSays` is
// rendered but never spoken, so the two-voices-per-press ordering in VC_GAME.md
// §9 item 4 remains unbuilt. When it lands, the seat speaks FIRST and the
// pitcher reacts, or the reaction lands under the wrong name.
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
  const panelRef = useRef(null);
  const lampRef = useRef(null);
  const rotorRefs = useRef([]);
  const nameRef = useRef(null);
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  const tlRef = useRef(null);
  const registerRotor = useCallback((i, el) => { rotorRefs.current[i] = el; }, []);

  useEffect(() => { Object.values(SFX).forEach(preloadSfx); }, []);
  useEffect(() => () => tlRef.current?.kill(), []);

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

    // Pin to the top first — the plate is up there, and an arrival you
    // scrolled past is a beat that may as well not have played.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    setRolling(true);
    const tl = runArrival({
      panel: panelRef.current,
      rotors: rotorRefs.current,
      lamp: lampRef.current,
      name: nameRef.current,
      nameText: deal.name,
      sheet: sheetRef.current,
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
     reacts after. VC_GAME.md §9 item 4 called the ordering out and warned what
     happens if it is wrong — "the reaction lands under the wrong name" — and the
     wrong version was worse than that: the floor voiced EVERY line as the
     pitcher, so pressing Eugene came back as the bot reading Eugene's finding
     (author, 2026-07-29).

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
    <div className="pf-wrap">
      <style>{CSS}</style>

      <div className="pf-bar">
        <button className="pf-exit" onClick={onExit}>◀ EXIT</button>
        {/* The bar names the deal only once the deal has a face. */}
        <span className="pf-tick">{identity ? deal.ticker : "· · ·"}</span>
        <span className="pf-book">BOOK <b>{Math.round(run.book)}</b></span>
      </div>

      {/* ---------- the briefing ----------
          NOTHING HERE MAY NAME THE DEAL BEFORE THE DICE STOP (invariant 7).
          Printing the deal's name and stats, and "John Barron brought this one
          in", over an empty table announced both before either had been picked
          — exactly the reveal this beat exists to stage.

          onClick={skipRoll}: a tap anywhere mid-arrival completes it —
          impatience is a legitimate input. No overlay needed on this surface,
          unlike the 3D view's pointer-events:none root; the handler sits on
          the column and no-ops once the roll is done. */}
      {!started && (
        <div className={`pf-scroll${rolled ? " is-rolled" : ""}`} ref={scrollRef}
             onClick={skipRoll}>
          <div className="pf-eyebrow">ONE DEAL ON THE TABLE</div>
          {/* THE DECODE LANDS HERE. runArrival writes ciphertext into this node
              and resolves it to deal.name; React renders the same string once
              `identity` flips, so the re-render is a no-op. */}
          <div className={`pf-name${identity ? "" : " facedown"}`} ref={nameRef}>
            {identity ? deal.name : "\u259a\u259a\u259a\u259a\u259a\u259a\u259a\u259a"}
          </div>
          <div className="pf-sub">
            {identity
              ? `${deal.ticker} · ${deal.chain} · ${deal.surface.age} old · ${deal.surface.mcap}`
              : "sent down from the desk above, still coded"}
          </div>

          {/* THE ARRIVAL. Picked fresh for this sitting; you can't ask for a
              different one without leaving and coming back. */}
          <div className="pf-roll">
            <EnigmaConsole arrived={rolled} ref={panelRef}
                           lampRef={lampRef} registerRotor={registerRotor} />
            {/* ONLY IN THE ARRIVED STATE. While waiting, the console already
                says AWAITING TRAFFIC — a caption repeating it put four near
                identical waiting lines on one screen, which reads as stuck. */}
            {rolled && (
              <div className="pf-roll-cap">
                SENT DOWN TO YOU · YOU DON&apos;T GET TO ASK WHY THIS ONE
              </div>
            )}
          </div>

          {/* The deal sheet, written in only once the agent is in. Every field
              is public surface data and none of it correlates with the outcome
              — asserted in the suite, because the moment the listing leaks the
              answer the analysts stop mattering. */}
          <div className={`pf-sheet${identity ? " in" : ""}`} ref={sheetRef}>
            {identity ? (
              <>
                <div className="pf-sheet-h">PROSPECT</div>
                <dl className="pf-sheet-stats">
                  <div><dt>MCAP</dt><dd>{deal.surface.mcap}</dd></div>
                  <div><dt>HOLDERS</dt><dd>{deal.surface.holders}</dd></div>
                  <div><dt>AGE</dt><dd>{deal.surface.age}</dd></div>
                  <div><dt>24H</dt><dd>{deal.surface.change24h}</dd></div>
                  <div><dt>SOCIAL</dt><dd>{deal.surface.social}</dd></div>
                </dl>
              </>
            ) : (
              <div className="pf-sheet-blank">▚▚▚  DECODING PENDING</div>
            )}
          </div>


          {/* The pitcher is an outside agent on commission. This said "John
              Barron brought this one in — it's his deal" until 2026-07-29, when
              the bot took over the selling and Barron joined the desk. */}
          <p className="pf-copy">
            An agent is here for a client who didn&apos;t come. It gets paid if you
            fund this.
          </p>
          <p className="pf-copy gold">
            You can interrupt <b>three times</b>. Whatever it can back lands on a
            screen. Whatever it can&apos;t, doesn&apos;t.
          </p>
          {/* Portraits, not card faces. Not buttons either: on the briefing
              these introduce the four, and the sendable version of the same
              row is SeatRow on the floor. */}
          <div className="pf-label">THE DESK — always these four, and the cat</div>
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
          <p className="pf-copy sm dim">
            Everyone here will answer anything you ask. Each has <b>one</b> subject
            they go deep on, and each answers <b>once</b>. Ask the wrong one and you
            still get an answer — just the shallow one, and they&apos;re spent.
          </p>

          {/* ONE BUTTON — a LOCAL/DAILY split lived here briefly and was cut.
              See the note in instanceDeal.js. */}
          <div className="pf-cta-row">
            <button className="pf-btn primary" disabled={rolling}
                    onClick={rolled ? begin : runRoll}>
              {rolled ? "HEAR THE PITCH ▸" : rolling ? "DECODING…" : "SEND IT IN ▸"}
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
const CSS = ARRIVAL_CSS + PRESS_UI_CSS + `
.pf-wrap { position:absolute; inset:0; display:flex; flex-direction:column;
  background:#02100e; color:#eafff9; font-family:'Courier New', monospace;
  overflow:hidden;
  /* PORTRAIT-FIRST, at any width. On a phone this is the whole screen; on
     desktop (?flat=1) it centres as a phone-shaped column with the room's
     dark behind it, so the fallback reads as intentional rather than as a
     stretched mobile page. */
  width:min(520px, 100%); margin:0 auto;
  border-left:1px solid rgba(47,214,214,0.16);
  border-right:1px solid rgba(47,214,214,0.16); }
@media (max-width:560px) { .pf-wrap { border:none; } }

/* THE DESK STRIP. These had NO CSS AT ALL until 2026-07-29 — .pf-strip and
   .pf-face existed only as class names, so the four portraits fell back to
   block layout and stacked. Styling them was forced by giving Virgil a divider
   at the end of the row: an unstyled 1px span in a block flow is invisible.
   Five tiles wrap on a narrow phone, which is fine — the cat wrapping onto its
   own line still reads as "and the cat", never as a fifth seat. */
/* The ciphertext placeholder is unbreakable glyphs in a column that gets down to
   ~266px, so it must be allowed to break. */
.pf-name { overflow-wrap:anywhere; }
.pf-strip { display:flex; flex-wrap:wrap; gap:8px; margin:6px 0 2px; min-width:0; }
.pf-face { flex:0 1 72px; min-width:0; max-width:72px;
  display:flex; flex-direction:column;
  align-items:center; gap:3px; text-align:center; }
.pf-face-pic { width:44px; height:44px; object-fit:cover; border-radius:50%;
  border:1px solid rgba(47,214,214,0.35); background:#020f0d; }
/* Two lines reserved for every name — "Detective Marisol" wraps and the others
   don't, which would drop her role label a line below everyone else's. */
.pf-face-who { font-size:8px; font-weight:bold; letter-spacing:0.03em;
  color:rgba(234,255,249,0.92); line-height:1.2; min-height:2.4em;
  display:flex; align-items:center; justify-content:center; }
.pf-face-role { font-size:7px; letter-spacing:0.1em; color:rgba(255,210,58,0.75); }

/* VIRGIL, at the end of the strip and set apart from it on purpose — not a seat,
   no lane, cannot be sent. The divider carries that; don't tidy it away. */
.pf-face-div { flex:none; align-self:center; width:1px; height:38px;
  background:rgba(234,255,249,0.16); margin:0 2px; }
.pf-face-cat .pf-face-pic { border-color:rgba(191,238,222,0.5); }
.pf-face-cat .pf-face-who { color:#bfeede; }
.pf-face-cat .pf-face-role { color:rgba(191,238,222,0.75); }
.pf-face-note { font-size:7px; letter-spacing:0.11em;
  color:rgba(191,238,222,0.5); margin-top:1px; }

/* The directive under his answer. Static — the tab does the attracting, and
   two things pulsing at once reads as an error state rather than a nudge. */
.pf-look { display:block; width:100%; margin-top:9px; cursor:pointer;
  background:rgba(47,214,214,0.10); border:1px solid rgba(47,214,214,0.55);
  color:#2fd6d6; font:bold 10px/1.2 'Courier New',monospace; letter-spacing:0.11em;
  padding:10px 8px; }
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
