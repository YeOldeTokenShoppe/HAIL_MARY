"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, dailySeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, SEATS, SEAT_LANE, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, EUGENE, eugeneRead } from "@/game/terminal-traders/press/desk";
import {
  PHASE, PRESSES,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt, seatOptions,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, coverageScore,
} from "@/game/terminal-traders/press/pressRun";
import { toDealCard, toExemplarCard, toCharacterCard } from "@/game/terminal-traders/press/dealCard";
import { speakAdviserLine, stopAdviserAudio, unlockAdviserAudio } from "@/lib/counselSpeech";
import TradingCard from "@/components/TradingCard";
import PressFigure from "./PressFigure";
import { preloadSfx } from "@/lib/uiSfx";
import gsap from "gsap";
import {
  DealtSlot, DealDeck, runCardDeal, prefersReducedMotion, SFX, DEAL_CSS,
} from "./cardDeal";
import { createFlatEvidenceScreen } from "./evidenceScreen";

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
// Three things it does that the 3D view CAN'T:
//   • Barron SPEAKS. /api/counsel-voice + the amplitude mouth means any
//     generated line can be voiced. Desktop is stuck with banked SitePal clips.
//   • The evidence screen is literally the screen. On desktop "his monitor
//     stays black" is a texture across the room; here the panel IS a terminal.
//   • Gyro holofoil — tilt the phone, the foil moves. See useGyroTilt below.

const VOICE = "JB";

/**
 * Feed device orientation into the same CSS vars TradingCard drives from
 * pointer position (--rx/--ry). iOS needs an explicit permission grant from a
 * user gesture; without it we simply never attach and cards keep their
 * touch/pointer behaviour. Never throws, never blocks the game.
 */
export function useGyroTilt(enabled) {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    if (!enabled || !granted || typeof window === "undefined") return;
    const onOrient = (e) => {
      // beta = front/back tilt, gamma = left/right. Clamped hard: past ~25° the
      // foil sweep stops reading as light and starts reading as a glitch.
      const rx = Math.max(-9, Math.min(9, ((e.beta ?? 0) - 45) * 0.18));
      const ry = Math.max(-11, Math.min(11, (e.gamma ?? 0) * 0.22));
      document.documentElement.style.setProperty("--gyro-rx", `${rx.toFixed(2)}deg`);
      document.documentElement.style.setProperty("--gyro-ry", `${ry.toFixed(2)}deg`);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [enabled, granted]);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !window.DeviceOrientationEvent) return;
    const need = typeof window.DeviceOrientationEvent.requestPermission === "function";
    if (!need) { setGranted(true); return; }
    try { setGranted((await window.DeviceOrientationEvent.requestPermission()) === "granted"); }
    catch { /* declined or unavailable — pointer tilt still works */ }
  }, []);

  return { granted, request };
}

export default function PressFlat({ deal: dealOverride = null, onExit }) {
  const deal = useMemo(() => {
    if (dealOverride) return dealOverride;
    const forced = typeof window !== "undefined"
      ? Number(new URLSearchParams(window.location.search).get("dealseed"))
      : NaN;
    return instanceDeal(Number.isFinite(forced) && forced > 0 ? forced : dailySeed());
  }, [dealOverride]);

  // THE DESK, not a hand. The deal still lays out five cards — the choreography
  // in ./cardDeal is untouched — but slots 1-4 are now the four people rather
  // than a speaker plus three questions. You're dealt the room.
  const DESK_ORDER = useMemo(() => [
    { ...DESK[SEATS.BARRON], cardId: "john-barron" },
    { ...DESK[SEATS.MARISOL], cardId: "marisol" },
    { ...DESK[SEATS.GR80], cardId: "gr80" },
    { ...EUGENE, cardId: "eugene" },
  ], []);

  const [run, setRun] = useState(() => createRun(deal));
  const [slider, setSlider] = useState(0);
  const [flash, setFlash] = useState(null);
  const [started, setStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [inspect, setInspect] = useState(null);
  // FEED | SCREEN. Not just a space-saver on a phone: a press CUTS to his
  // screen, so "nothing landed" is something you went and looked at rather
  // than something you passively failed to notice.
  const [pane, setPane] = useState("feed");
  // Mirrored into state because the tab label reads it during render — a ref
  // would never re-render and the badge would stay stale after a press.
  const [hasRecord, setHasRecord] = useState(false);
  const [boardPane, setBoardPane] = useState(SEATS.BARRON);
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
  const gyro = useGyroTilt(true);

  /* ---- the deal ----
     Same choreography as the 3D view (./cardDeal), with one thing this surface
     has to solve that the desktop panel doesn't: the briefing is a SCROLLING
     column taller than a phone, so the hero card and the hand strip are never
     on screen together. We pin the view to the top before measuring — the deal
     card landing is what unseals the name, so that's the beat worth seeing —
     and then slide down to the hand once it's dealt. */
  const [dealt, setDealt] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [landed, setLanded] = useState(0);
  const identity = dealt || landed >= 1;      // slot 0 — the deal card
  // The desk no longer flips. Dealing the four characters was ceremony for a
  // DRAW, and there is no draw any more — the same four people are at the desk
  // every session, so turning them face-down and back over was theatre for a
  // non-event. The one genuinely unknown thing is the deal, so that is the one
  // card that still lands face-down and turns. (author, 2026-07-27)
  const speakerNamed = true;
  const deckRef = useRef(null);
  const slotRefs = useRef([]);
  const scrollRef = useRef(null);
  const stripRef = useRef(null);
  const tlRef = useRef(null);
  const registerSlot = useCallback((i, el) => { slotRefs.current[i] = el; }, []);

  useEffect(() => { Object.values(SFX).forEach(preloadSfx); }, []);
  useEffect(() => () => tlRef.current?.kill(), []);

  // Slide the hand into view as the DEAL card lands, not after the whole deal:
  // at rest the strip sits under the sticky deck, so the three questions would
  // otherwise land behind it and below the fold.
  //
  // Scrolling mid-flight is safe. Every `.deal-fly` is absolutely positioned
  // INSIDE its own slot and tweens to x:0,y:0, so it lands correctly wherever
  // that slot has moved to; only the apparent flight path shifts. And because
  // the deck is sticky it doesn't move at all, so the cards simply appear to
  // fly up out of it as the table rises to meet them.
  const revealHand = useCallback(() => {
    const sc = scrollRef.current, strip = stripRef.current;
    if (!sc || !strip) return;
    gsap.to(sc, {
      scrollTop: Math.max(0, strip.offsetTop - 90),
      duration: 0.6, ease: "power2.inOut",
    });
  }, []);

  const runDeal = useCallback(() => {
    if (dealing || dealt) return;
    if (prefersReducedMotion()) { setDealt(true); return; }

    // Pin to the top BEFORE measuring: scrollTop is applied synchronously, so
    // the rects we take next are already the post-scroll ones.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    setDealing(true);
    const tl = runCardDeal({
      deck: deckRef.current,
      slots: slotRefs.current,
      captionSelector: ".pf-cap",
      onLanded: (i) => {
        setLanded((n) => Math.max(n, i + 1));
        if (i === 0) revealHand();   // the hand rises while the rest is in the air
      },
      onDone: () => { setDealing(false); setDealt(true); },
    });
    if (!tl) { setDealing(false); setDealt(true); return; }
    tlRef.current = tl;
  }, [dealing, dealt, revealHand]);

  const skipDeal = useCallback(() => {
    if (dealing) tlRef.current?.progress(1);
  }, [dealing]);

  const claim = currentClaim(run, deal);
  const onFloor = started && run.phase === PHASE.FLOOR;

  const dealCard = useMemo(() => toDealCard(deal), [deal]);
  const patternCard = useMemo(() => toExemplarCard(deal), [deal]);
  const deskCards = useMemo(
    () => DESK_ORDER.map((m) => ({ m, data: toCharacterCard(m.cardId, m.role) })), [DESK_ORDER]);
  const speakerCard = deskCards[0]?.data;
  // Who can be sent at the claim on the floor, and why not. Straight from the
  // controller so the button states can never disagree with the rules.
  const options = useMemo(() => seatOptions(run, deal), [run, deal]);
  const readout = useMemo(() => callReadout(slider), [slider]);
  const read = useMemo(() => coverageScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;
  // A press is legal only while he's on a claim you haven't already answered
  // and you still have budget. The dock shows the press affordances ONLY then
  // — see the note on .pf-dock below for why that's structural, not cosmetic.
  const canPress = run.pressesLeft > 0 && !pressed;
  const lastClaim = run.claimIndex >= deal.claims.length - 1;
  const advisersLeft = SPENDABLE_SEATS.filter((x) => !run.advisersSpent.includes(x)).length;
  // Eugene is free and automatic — he reads the shape of every claim and points
  // at whose lane it is. He never stamps a receipt, so he can never carry the
  // answer; he only tells you who COULD settle it.
  const eugeneLine = useMemo(() => (claim ? eugeneRead(claim) : ""), [claim]);

  /* ---- the evidence screen, as an actual on-screen terminal ---- */
  // THREE boards, not one. Barron's, Marisol's and GR80's — Eugene never
  // stamps anything, by design, so he has no board to keep. Only one is on
  // screen at a time; the strip below is how you move between them.
  const BOARDS = useMemo(() => [SEATS.BARRON, SEATS.MARISOL, SEATS.GR80], []);
  const screensRef = useRef({});
  useEffect(() => {
    if (!started) return;
    const made = {};
    for (const seat of BOARDS) {
      const el = document.getElementById(`pf-screen-${seat}`);
      if (!el) continue;
      made[seat] = createFlatEvidenceScreen(el, { header: DESK[seat].name.toUpperCase() });
    }
    screensRef.current = made;
    screenRef.current = made[SEATS.BARRON] || null;
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

  const press = useCallback((seat = SEATS.BARRON) => {
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
      asked: outcome.seat === SEATS.BARRON
        ? "Put a number on it."
        : `${DESK[outcome.seat].name} — ${DESK[outcome.seat].role}`,
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
    Promise.all([say(outcome.line), new Promise((r) => setTimeout(r, MIN_BEAT))])
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
    setBoardPane(SEATS.BARRON);
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

  // The start tap is the ONLY user gesture we're guaranteed, so it has to do
  // double duty: unlock the audio context (iOS will not play a decoded buffer
  // without one) and request the gyro permission (iOS gates that on a gesture
  // too). Both fail soft — no audio or no tilt still leaves a playable game.
  const begin = useCallback(() => {
    try { unlockAdviserAudio(); } catch {}
    gyro.request();
    setStarted(true);
  }, [gyro]);

  /* ------------------------------------------------------------------ */
  return (
    <div className="pf-wrap">
      <style>{CSS}</style>

      {inspect && (
        <div className="pf-inspect" onClick={() => setInspect(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TradingCard data={inspect} scale={0.42} interactive templateStyle="terminal" />
          </div>
          <button className="pf-btn ghost" onClick={() => setInspect(null)}>✕ CLOSE</button>
        </div>
      )}

      <div className="pf-bar">
        <button className="pf-exit" onClick={onExit}>◀ EXIT</button>
        {/* The bar names the deal only once the deal has a face. */}
        <span className="pf-tick">{identity ? deal.ticker : "· · ·"}</span>
        <span className="pf-book">BOOK <b>{Math.round(run.book)}</b></span>
      </div>

      {/* ---------- the briefing ----------
          NOTHING HERE MAY NAME A CARD THAT ISN'T FACE-UP YET. Printing the
          deal's name and stats, and "John Barron brought this one in", over an
          empty table announced both before either had been dealt — which is
          exactly the reveal this beat exists to stage.

          onClick={skipDeal}: a tap anywhere mid-deal lands the rest —
          impatience is a legitimate input. No overlay needed on this surface,
          unlike the 3D view's pointer-events:none root; the handler sits on
          the column and no-ops once the deal is done. */}
      {!started && (
        <div className={`pf-scroll${dealt ? " is-dealt" : ""}`} ref={scrollRef}
             onClick={skipDeal}>
          <div className="pf-eyebrow">ONE DEAL ON THE TABLE</div>
          <div className={`pf-name${identity ? "" : " facedown"}`}>
            {identity ? deal.name : "FACE DOWN"}
          </div>
          <div className="pf-sub">
            {identity
              ? `${deal.ticker} · ${deal.chain} · ${deal.surface.age} old · ${deal.surface.mcap}`
              : "the house hasn't turned it over yet"}
          </div>
          <div className="pf-hero" onClick={() => dealt && setInspect(dealCard)}>
            <DealtSlot index={0} scale={0.34} register={registerSlot}>
              {dealCard && <TradingCard data={dealCard} scale={0.34} interactive templateStyle="terminal" />}
            </DealtSlot>
          </div>
          {/* Both versions are the same shape, so the swap reads as the name
              filling in rather than the paragraph rewriting itself. */}
          <p className="pf-copy">
            {speakerNamed
              ? "John Barron brought this one in. It's his deal — if you fund it, he gets paid."
              : "Someone at this desk brought this one in. It's their deal — if you fund it, they get paid."}
          </p>
          <p className="pf-copy gold">
            You can interrupt {speakerNamed ? "him" : "them"} <b>three times</b>. Whatever{" "}
            {speakerNamed ? "he" : "they"} can back lands on {speakerNamed ? "his" : "their"}{" "}
            screen. Whatever {speakerNamed ? "he" : "they"} can't, doesn't.
          </p>
          <div className="pf-label">THE DESK — always these four</div>
          <div className="pf-strip" ref={stripRef}>
            {deskCards.map(({ m, data }) => (
              <button key={m.id} className="pf-thumb" onClick={() => setInspect(data)}>
                <TradingCard data={data} scale={0.15} interactive={false} templateStyle="terminal" />
                <span className="pf-cap">{m.role}</span>
              </button>
            ))}
          </div>
          {dealt && (
            <p className="pf-copy sm dim">
              Marisol and GR80 will each answer <b>one</b> claim, in their own lane.
              Barron you can press as often as you like. Eugene reads every claim for free.
            </p>
          )}
          {/* Sticky: on a phone this column is taller than the screen, and the
              deck has to stay visible or the cards fly out of nowhere. */}
          <div className="pf-cta-row">
            <DealDeck ref={deckRef} spent={dealt || dealing} />
            <button className="pf-btn primary" disabled={dealing}
                    onClick={dealt ? begin : runDeal}>
              {dealt ? "LET HIM PITCH ▸" : dealing ? "DEALING…" : "DEAL ME IN ▸"}
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
                        {DESK[seat].role}
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
            <div className="pf-claim">
              <div className="pf-claim-who">
                JOHN BARRON <span className="pf-dim">— his deal</span>
                <span className="pf-count">{run.claimIndex + 1} / {deal.claims.length}</span>
              </div>
              <div className="pf-spin">“{claim.spin}”</div>
              {/* THE LANE, STATED. The seat row enforces this, but enforcement
                  without explanation reads as a broken button — the first
                  playtest note was "can't tell why only GR80 is available".
                  Say whose question it is, at a size you can actually read. */}
              <div className="pf-lane" data-lane={claim.lane}>
                {claim.lane === LANES.SHAPE
                  ? "NOBODY HERE CAN SETTLE THIS ONE — press him or let it go"
                  : `${claim.lane} QUESTION — only ${DESK[claim.lane === LANES.CHAIN ? SEATS.MARISOL : SEATS.GR80].name} can settle it`}
              </div>
              <div className="pf-fact"><span className="pf-tag">FACT</span> {claim.fact}</div>
              {/* Eugene, free, on every claim. He names the SHAPE of the claim
                  and whose lane could settle it — never whether it's true. He
                  has no board and stamps nothing, so he can't carry an answer. */}
              <div className="pf-eugene">
                <span className="pf-eu-who">EUGENE</span>
                <span className="pf-eu-line">{eugeneLine}</span>
              </div>
            </div>

            {flash && flash.id === claim.id && (
              /* The panel's COLOUR is a tell too — grey for vibes, grey for a
                 wasted card. Held back with the verdict, so every answer looks
                 identical until he's finished and you've been to the board. */
              <div className={`pf-answer ${!flash.revealed ? "" : flash.wasted ? "wasted" : flash.backing === BACKING.VIBES ? "vibes" : ""}`}>
                <div className="pf-asked">YOU ASKED — “{flash.asked}”</div>
                <div className="pf-said">“{flash.line}”</div>
                {!flash.revealed ? (
                  <div className="pf-note waiting">▚ HE'S STILL TALKING…</div>
                ) : lookPending ? (
                  <button className="pf-look" onClick={lookAtScreen}>
                    ▤ HE'S FINISHED — SEE WHAT LANDED ▸
                  </button>
                ) : (
                  <div className="pf-note">
                    {flash.wasted ? "✕ TRUE, AND NOT WHAT YOU NEEDED."
                      : flash.named ? "▚ STILL BLACK — but you know what kind of nothing this is."
                        : flash.backing === BACKING.VIBES ? "▚ HIS SCREEN STAYS BLACK."
                          : flash.backing === BACKING.SOFT ? "◍ PARTIAL — some of it landed."
                            : "◼ ON RECORD."}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pf-dock">
            <div className="pf-pips">
              {Array.from({ length: PRESSES }).map((_, i) => (
                <span key={i} className={i < run.pressesLeft ? "on" : ""} />
              ))}
              <em>INTERRUPTIONS LEFT</em>
              <b>{advisersLeft} ADVISER{advisersLeft === 1 ? "" : "S"}</b>
            </div>

            {/* PRESS HIM and the hand are here only while a press is LEGAL.
                Once you've had your answer they are dead controls, and 195px of
                dead controls pinned to the bottom of a phone is exactly what
                shoved the one live control off the screen. The counter above
                keeps the hand accounted for while it's away; it comes back on
                the next claim. */}
            {canPress ? (
              <div className="pf-seats">
                {options.map((o) => {
                  const meta = DESK[o.seat];
                  const card = deskCards.find((d) => d.m.id === o.seat);
                  const isBarron = o.seat === SEATS.BARRON;
                  return (
                    <button
                      key={o.seat}
                      className={`pf-seat ${isBarron ? "boss" : ""} ${o.enabled ? "" : "off"}`}
                      disabled={!o.enabled}
                      onClick={() => press(o.seat)}
                    >
                      {card && (
                        <TradingCard data={card.data} scale={0.105} interactive={false} templateStyle="terminal" />
                      )}
                      <span className="pf-seat-name">{isBarron ? "PRESS HIM" : meta.role}</span>
                      <span className="pf-seat-sub">
                        {isBarron ? "put a number on it"
                          : o.reason === "spent" ? "already used"
                            : o.reason === "off-lane" ? "not their lane"
                              : "send them"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="pf-spent">
                {pressed ? "◼ YOU'VE HAD YOUR ANSWER ON THIS ONE."
                  : "▚ NO INTERRUPTIONS LEFT — THE REST IS ON FAITH."}
              </div>
            )}

            {/* On the last claim `advance` and `callIt` are the SAME
                transition (pressRun.advance: next >= claims.length -> ALLOCATION),
                so two buttons there would be two labels for one door. */}
            <div className="pf-nav">
              {lastClaim ? (
                <button className="pf-btn primary sm" onClick={callIt}>
                  THAT'S THE PITCH — CALL IT ▸
                </button>
              ) : (
                <>
                  <button className={`pf-btn${pressed ? " primary sm" : ""}`} onClick={advance}>
                    LET HIM GO ON ▸
                  </button>
                  <button className="pf-btn amber" onClick={callIt}>CALL IT</button>
                </>
              )}
            </div>
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
          <div className="pf-label">THE AUTOPSY</div>
          <div className="pf-scores">
            <div><em>READ</em><b>{read.hit}/{read.spent || 0}</b></div>
            <div><em>BOOK</em><b>{Math.round(run.book)}</b></div>
          </div>
          {patternCard && (
            <div className="pf-pattern">
              <div onClick={() => setInspect(patternCard)}>
                <TradingCard data={patternCard} scale={0.22} interactive={false} templateStyle="terminal" />
              </div>
              <div>
                <div className="pf-label">YOU'VE SEEN THIS SHAPE BEFORE</div>
                <div className="pf-name sm">{deal.exemplar.name}</div>
                <p className="pf-copy sm">{deal.exemplar.note}</p>
              </div>
            </div>
          )}
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

const CSS = DEAL_CSS + `
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
.pf-dim { color:rgba(234,255,249,0.5); }

/* gyro tilt — TradingCard reads --rx/--ry; on a phone we drive them from the
   accelerometer instead of the pointer, so the foil moves as you tilt. */
.pf-wrap .tc-stage { --rx:var(--gyro-rx, 0deg); --ry:var(--gyro-ry, 0deg); }

.pf-bar { flex:none; display:flex; align-items:center; justify-content:space-between;
  gap:10px; padding:10px 12px; border-bottom:1px solid rgba(47,214,214,0.25);
  font-size:11px; letter-spacing:0.08em; }
.pf-exit { background:none; border:1px solid rgba(47,214,214,0.45); color:#2fd6d6;
  font:inherit; font-size:10px; padding:5px 9px; }
.pf-tick { font-weight:bold; letter-spacing:0.12em; }
.pf-book b { color:#ffd23a; margin-left:5px; }

.pf-scroll { flex:1; overflow-y:auto; padding:16px 14px 28px;
  -webkit-overflow-scrolling:touch; }
/* "safe center" centres until the content is taller than the box, then falls
   back to start alignment. Plain centring overflows in BOTH directions and the
   top of a long resolution becomes unscrollable-to — the same class of bug as
   the floor's clipped dock, one phase later. (No backticks in this sheet: it
   is a template literal.) */
.pf-scroll.center { display:flex; flex-direction:column; align-items:center;
  justify-content:center; justify-content:safe center; text-align:center; }
.pf-eyebrow { font-size:9.5px; letter-spacing:0.18em; color:#ff5f9e; font-weight:bold; }
.pf-name { font-size:23px; font-weight:bold; letter-spacing:0.05em; margin-top:5px; }
.pf-name.sm { font-size:15px; }
.pf-sub { font-size:10.5px; letter-spacing:0.07em; color:rgba(234,255,249,0.5); margin-top:3px; }
.pf-hero { display:flex; justify-content:center; margin:14px 0; cursor:zoom-in; }
.pf-copy { font-size:13px; line-height:1.5; margin:10px 0; }
.pf-copy.gold { color:#ffd23a; }
.pf-copy.sm { font-size:11.5px; }
.pf-label { font-size:9px; letter-spacing:0.14em; font-weight:bold;
  color:rgba(255,210,58,0.85); margin:14px 0 8px; }

.pf-strip { display:flex; gap:9px; overflow-x:auto; padding-bottom:6px;
  -webkit-overflow-scrolling:touch; }
.pf-strip.tight { gap:7px; }
/* One caption wrapping to two lines grows the WHOLE dock row, so in the dock
   they are single-line and clipped. The full name is one tap away on the card. */
.pf-strip.tight .pf-thumb span { max-width:86px; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.pf-thumb { flex:0 0 auto; background:none; border:none; padding:0;
  display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; }
.pf-thumb span { font:bold 9.5px/1.25 'Courier New',monospace; letter-spacing:0.08em;
  color:rgba(234,255,249,0.6); max-width:74px; }
.pf-thumb.spent, .pf-thumb:disabled { opacity:0.35; }

/* THE DEAL — slot/deck/flip styles come from cardDeal's DEAL_CSS at the end of
   this sheet. Local to this surface: what may be tapped, and a deck that stays
   put while the column scrolls. Captions are held back with the cards they
   name (opacity, not display, so nothing reflows when they arrive). */
.pf-scroll:not(.is-dealt) .pf-hero,
.pf-scroll:not(.is-dealt) .pf-thumb { pointer-events:none; }
.pf-cap { opacity:0; }
.pf-scroll.is-dealt .pf-cap { opacity:1; }
.pf-scroll.is-dealt .deal-fly { opacity:1; }
.pf-scroll.is-dealt .deal-ghost { opacity:0; }
.pf-name.facedown { color:rgba(234,255,249,0.3); letter-spacing:0.12em; }
.pf-hero .deal-slot { margin:0 auto; }
/* The briefing is taller than a phone, so the deck rides the bottom of the
   column — otherwise you press DEAL while it's scrolled off and the cards
   appear to come from nowhere. */
.pf-cta-row { position:sticky; bottom:0; z-index:4; display:flex; align-items:center;
  gap:12px; margin-top:14px; padding:10px 0 4px;
  background:linear-gradient(180deg, rgba(3,18,16,0) 0%, rgba(3,18,16,0.92) 38%); }
.pf-cta-row .pf-btn.primary { flex:1; margin:0; }

/* the floor — portrait, thumb-first.
   ONE SCROLLER, THREE PINNED ROWS. .pf-read is the only child that may grow or
   scroll; the tabs, the feed and the dock are fixed furniture. Every row used
   to be flex:none inside this overflow:hidden column, which meant the column
   was simply taller than the phone and the bottom of it — the dock's nav — was
   unreachable. If you add a row here, it goes inside .pf-read or it gets a
   height budget. */
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

.pf-claim { padding:10px 14px; border-left:2px solid #ff5f9e; margin:0 12px; }
.pf-claim-who { display:flex; align-items:baseline; gap:6px;
  font-size:9.5px; letter-spacing:0.13em; color:#ff5f9e; font-weight:bold; }
.pf-count { margin-left:auto; color:rgba(234,255,249,0.4); letter-spacing:0.1em; }
.pf-spin { font-size:14px; line-height:1.42; margin:6px 0 8px; }
.pf-eugene { display:flex; gap:8px; align-items:baseline; margin-top:8px;
  padding-top:7px; border-top:1px dashed rgba(191,238,222,0.22); }
.pf-eu-who { flex:none; font:bold 10px/1.45 'Courier New',monospace; letter-spacing:0.11em;
  color:#bfeede; }
.pf-eu-line { font-size:12.5px; line-height:1.45; color:rgba(191,238,222,0.85); font-style:italic; }

/* the agenda — every subject he'll cover, lane-dotted */
.pf-agenda { flex:none; display:flex; gap:5px; overflow-x:auto; padding:8px 12px 6px;
  -webkit-overflow-scrolling:touch; }
.pf-ag { flex:0 0 auto; font:bold 9.5px/1 'Courier New',monospace; letter-spacing:0.07em;
  padding:7px 9px; border:1px solid rgba(234,255,249,0.16); color:rgba(234,255,249,0.45);
  white-space:nowrap; position:relative; }
.pf-ag::before { content:""; display:inline-block; width:5px; height:5px; border-radius:50%;
  margin-right:5px; vertical-align:middle; background:rgba(234,255,249,0.3); }
.pf-ag[data-lane="CHAIN"]::before  { background:#2fd6d6; }
.pf-ag[data-lane="RECORD"]::before { background:#ffd23a; }
.pf-ag.past { opacity:0.4; }
.pf-ag.now  { border-color:#ff5f9e; color:#fff; }
.pf-ag.done { border-style:dashed; }

/* the seat row — you send a PERSON, not a menu option */
.pf-seats { display:flex; gap:6px; }
.pf-seat { flex:1; min-width:0; background:rgba(2,16,14,0.9);
  border:1px solid rgba(47,214,214,0.35); color:#eafff9; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:3px; padding:7px 4px 6px;
  font:inherit; transition:transform .12s ease, border-color .12s ease; }
.pf-seat:hover:not(:disabled) { transform:translateY(-2px); border-color:#2fd6d6; }
.pf-seat.boss { border-color:rgba(255,45,111,0.6); background:rgba(60,6,28,0.55); }
.pf-seat.boss:hover:not(:disabled) { border-color:#ff2d6f; }
.pf-seat.off, .pf-seat:disabled { cursor:default; opacity:0.55; filter:grayscale(0.85);
  border-color:rgba(234,255,249,0.14); background:rgba(2,16,14,0.55); }
.pf-seat.off .pf-seat-name, .pf-seat:disabled .pf-seat-name { color:rgba(234,255,249,0.45); }
.pf-seat.off .pf-seat-sub, .pf-seat:disabled .pf-seat-sub { color:rgba(255,155,111,0.9); }

/* whose question is this — said plainly, above the row that enforces it */
.pf-lane { margin-top:9px; padding:7px 9px; font:bold 10px/1.4 'Courier New',monospace;
  letter-spacing:0.07em; border-left:3px solid rgba(234,255,249,0.3);
  background:rgba(234,255,249,0.04); color:rgba(234,255,249,0.75); }
.pf-lane[data-lane="CHAIN"]  { border-left-color:#2fd6d6; color:#8ff0f0;
  background:rgba(47,214,214,0.08); }
.pf-lane[data-lane="RECORD"] { border-left-color:#ffd23a; color:#ffe487;
  background:rgba(255,210,58,0.08); }
.pf-seat-name { font:bold 11px/1.25 'Courier New',monospace; letter-spacing:0.09em; }
.pf-seat.boss .pf-seat-name { color:#ff5f9e; }
.pf-seat-sub { font-size:9.5px; line-height:1.3; letter-spacing:0.02em; color:rgba(234,255,249,0.62); }

/* three boards, one visible, plus the text comparison strip */
.pf-boards { width:100%; display:flex; flex-direction:column; gap:7px; }
.pf-screen { display:none; }
.pf-screen.show { display:block; }
.pf-bstrip { display:flex; gap:4px; }
.pf-bchip { flex:1; background:rgba(2,16,14,0.85); border:1px solid rgba(47,214,214,0.22);
  color:rgba(234,255,249,0.6); font:bold 10px/1.35 'Courier New',monospace;
  letter-spacing:0.07em; padding:7px 4px; cursor:pointer;
  display:flex; flex-direction:column; gap:2px; }
.pf-bchip.on { border-color:#2fd6d6; color:#2fd6d6; background:rgba(47,214,214,0.08); }
.pf-bchip em { font-style:normal; font-weight:normal; font-size:9px; opacity:0.8; }
.pf-bchip.rec em { color:#ffd23a; opacity:1; }
.pf-bchip.nil em { color:#ff9b6f; opacity:1; }
.pf-fact { font-size:11.5px; line-height:1.4; color:rgba(234,255,249,0.85);
  border-top:1px solid rgba(47,214,214,0.2); padding-top:7px; }
.pf-tag { font-size:8.5px; letter-spacing:0.13em; background:#2fd6d6; color:#02100e;
  font-weight:bold; padding:2px 4px; margin-right:5px; }

.pf-tabs { flex:none; display:flex; gap:1px; margin:0 12px; }
.pf-tabs button { flex:1; background:rgba(2,16,14,0.9); border:1px solid rgba(47,214,214,0.22);
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

.pf-answer { margin:10px 12px 0; padding:10px 12px;
  background:rgba(4,20,15,0.95); border:1.5px solid #ffd23a; }
.pf-answer.vibes { border-color:#7a8b86; }
.pf-answer.wasted { border-color:#7a8b86; }
.pf-asked { font-size:8.5px; letter-spacing:0.11em; color:rgba(234,255,249,0.5); }
.pf-said { font-size:12.5px; line-height:1.45; font-style:italic; margin-top:5px; }
.pf-note { font-size:9.5px; letter-spacing:0.09em; font-weight:bold; color:#ffd23a; margin-top:7px; }
/* holds the verdict's place while he's still saying it, so the panel doesn't
   jump when the real line arrives */
.pf-note.waiting { color:rgba(234,255,249,0.35); font-weight:normal; }
.pf-answer.vibes .pf-note { color:#bfeede; }
.pf-answer.wasted .pf-note { color:#ff9b6f; }

/* PINNED, AND ON A HEIGHT BUDGET. It carries the only controls that move the
   game forward, so anything added here is taken off the reading column above.
   Roughly 195px while a press is live, ~95px once it isn't. */
.pf-dock { flex:none; padding:9px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  border-top:1px solid rgba(47,214,214,0.25); background:rgba(2,16,14,0.96); }
.pf-pips { display:flex; align-items:center; gap:5px; margin-bottom:8px; }
.pf-pips span { width:10px; height:10px; border-radius:50%; border:1.5px solid rgba(255,45,111,0.6); }
.pf-pips span.on { background:#ff2d6f; box-shadow:0 0 8px rgba(255,45,111,0.8); }
.pf-pips em { font-style:normal; font-size:9.5px; letter-spacing:0.11em;
  color:rgba(234,255,249,0.5); margin-left:4px; }
/* keeps the hand accounted for in the beats where the strip isn't shown */
.pf-pips b { margin-left:auto; font-size:8.5px; letter-spacing:0.11em;
  color:rgba(47,214,214,0.75); }
.pf-spent { font-size:9px; letter-spacing:0.11em; color:rgba(234,255,249,0.42);
  text-align:center; padding:3px 0 1px; }
.pf-nav { display:flex; gap:8px; margin-top:8px; }
.pf-nav .pf-btn { flex:1; margin-top:0; }

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
.pf-pattern { display:flex; gap:12px; align-items:flex-start; margin:8px 0 16px;
  padding:10px; background:rgba(255,210,58,0.05); border:1px solid rgba(255,210,58,0.28); }
.pf-au { border-left:2px solid rgba(234,255,249,0.16); padding:7px 0 7px 10px; margin-bottom:10px; }
.pf-au.pressed { border-left-color:#ffd23a; }
.pf-au-fact { font-size:12px; }
.pf-au-verdict { font-size:11px; color:#2fd6d6; margin-top:3px; }

.pf-inspect { position:fixed; inset:0; z-index:10070; display:flex; flex-direction:column;
  gap:12px; align-items:center; justify-content:center; padding:16px; overflow:auto;
  background:rgba(2,10,9,0.92); backdrop-filter:blur(4px); }
`;
