"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, rollSeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, PITCHER, SEATS, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, DESK_ORDER, PITCH_BOT, laneOwner, laneSentence, pitcherAside, seatMeta } from "@/game/terminal-traders/press/desk";
import { VIRGIL, virgilRead } from "@/game/terminal-traders/press/virgil";
import {
  PHASE, PRESSES, STAKE,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, coverageScore, seatOptions, laneOutlook, pressure,
} from "@/game/terminal-traders/press/pressRun";
import { preloadSfx } from "@/lib/uiSfx";
import { speakAdviserLine, stopAdviserAudio, unlockAdviserAudio } from "@/lib/counselSpeech";
import { playUnicornBeat, stopUnicornBeat } from "@/lib/trade/playUnicornBeat";
import { setUnicornGlow } from "@/lib/trade/unicornGlow";
import {
  EnigmaConsole, runArrival, prefersReducedMotion, SFX, ARRIVAL_CSS,
} from "./arrival";
import { createEvidenceScreen } from "./evidenceScreen";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, SeatRow, Meter, Nav, Transcript,
  PRESS_UI_CSS,
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
// This was "Demon" — John Barron's agentId — for as long as he was the one
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
const VOICE = "PB";

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

  // THE ARRIVAL. `rolled` gates the panel's CTA: the message decodes, THEN you
  // let the agent pitch. Two beats, because watching the appointment land is the
  // moment the session starts belonging to you. (Named `rolled` from the dice
  // era; it is the arrival now — renaming it touches both surfaces for nothing.)
  const [rolled, setRolled] = useState(false);
  const [rolling, setRolling] = useState(false);
  // NOTHING ON THIS PANEL MAY NAME THE DEAL BEFORE THE DICE STOP (invariant 7).
  // Printing "ALDERMAN · $ALDR · $7.5M" and "John Barron brought this one in"
  // over an empty table announced both the deal and the speaker before either
  // had been picked — precisely the reveal this beat exists to stage.
  //
  // Under the card deal these were two separate gates, because the deal card
  // and the speaker's card turned over at different moments. One roll has one
  // settle, so they're now the same instant and the two names arrive together.
  const [settled, setSettled] = useState(false);
  const identity = rolled || settled;
  const panelRef = useRef(null);
  const lampRef = useRef(null);
  const rotorRefs = useRef([]);
  const nameRef = useRef(null);
  const sheetRef = useRef(null);
  const tlRef = useRef(null);
  const registerRotor = useCallback((i, el) => { rotorRefs.current[i] = el; }, []);

  const claim = currentClaim(run, deal);
  const onFloor = started && run.phase === PHASE.FLOOR;

  /* ---- the evidence screen ----
     We don't own a texture. VideoScreens already owns the seat's mesh, canvas
     and material; we borrow the canvas through the EvidenceScreens handshake
     and hand it back on unmount. See evidenceScreen.js for why. */
  useEffect(() => {
    const s = createEvidenceScreen({ station: SPEAKER_STATION, header: "THE AGENT" });
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

  // SPEECH STATE NOW FOLLOWS ACTUAL AUDIO. It used to be pinned true for the
  // whole floor, which told the room "still talking" through every silence — the
  // bot's talking clip would have run for four minutes straight.
  useEffect(() => {
    onSpeechActive?.(onFloor && speaking);
    return () => onSpeechActive?.(false);
  }, [onFloor, speaking, onSpeechActive]);

  /* ---- a claim takes the floor, then becomes pressable ---- */
  useEffect(() => {
    if (!onFloor) return;
    setClaimVisible(false);
    const t = setTimeout(() => setClaimVisible(true), 260);
    return () => clearTimeout(t);
  }, [run.claimIndex, onFloor]);

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
  useEffect(() => () => tlRef.current?.kill(), []);

  const runRoll = useCallback(() => {
    if (rolling || rolled) return;
    // Someone who asked not to be moved gets the deal, not the choreography.
    if (prefersReducedMotion()) { setSettled(true); setRolled(true); return; }

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
  useEffect(() => {
    if (!onFloor || !claim) return;
    sayTurn([{ voice: VOICE, text: claim.spin, agent: PITCHER_AGENT }]);
    return () => { try { stopAdviserAudio(); } catch {} try { stopUnicornBeat(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFloor, run.claimIndex]);

  useEffect(() => () => {
    try { stopAdviserAudio(); } catch {}
    try { stopUnicornBeat(); } catch {}
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

  const sayTurn = useCallback(async (parts) => {
    const live = parts.filter((p) => p && p.text);
    if (!live.length) return;
    const token = ++sayToken.current;
    setSpeaking(true);
    try {
      for (const p of live) {
        if (sayToken.current !== token) return;   // superseded — stop the chain
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
        const left = MIN_DWELL_MS - (Date.now() - startedAt);
        if (left > 0) await new Promise((r) => setTimeout(r, left));
      }
    } finally {
      if (sayToken.current === token) setSpeaking(false);
    }
  }, [onFocusAgent, speakLine]);

  /* ---- actions ---- */
  // One path, four seats. Every seat can be sent at every claim — the lane
  // decides DEPTH, not permission. Barron is reusable; the other three are one
  // use each. A send is only ever refused for a reason the player can see: no
  // budget left, or that colleague is already spent.
  const press = useCallback((seat = PITCHER) => {
    if (!onFloor) return;
    const next = doPress(run, deal, seat);
    if (next === run) return;
    const outcome = next.outcomes[claim.id];
    setRun(next);
    setFlash({
      id: claim.id,
      seat: outcome.seat,
      board: outcome.board,
      backing: outcome.backing,
      nothingOnFile: outcome.nothingOnFile,
      adviserSays: outcome.adviserSays,
      line: outcome.barronSays,
      asked: outcome.seat === PITCHER
        ? "Put a number on it."
        : `${seatMeta(outcome.seat).name} — ${seatMeta(outcome.seat).role}`,
    });

    // The seat reports in its own voice on its own camera, then the pitcher
    // reacts on his. Order matters, and so does the handover.
    sayTurn([
      {
        voice: seatMeta(outcome.seat)?.voice,
        text: outcome.adviserSays,
        agent: seatMeta(outcome.seat)?.agentId,
      },
      { voice: VOICE, text: outcome.barronSays, agent: PITCHER_AGENT },
    ]);

    // THE ANSWER LANDS ON WHOEVER WENT AND GOT IT — on their own monitor, in
    // the room. That's the whole reason this design is worth the four seats:
    // three boards lit differently at the moment you call it is a picture only
    // this scene can render.
    const board = screensRef.current[outcome.board];
    if (outcome.receipt) board?.stamp(outcome.receipt);
    else if (outcome.nothingOnFile) board?.stampNothing(claim.subject);
    else board?.stayBlack();

    // NO CUT HERE ANY MORE. This fired once, to whoever answered, and then the
    // camera stayed put for the rest of the exchange. sayTurn owns the frame
    // during a press because it is the only thing that knows who is talking.
  }, [run, deal, claim, onFloor, sayTurn]);

  const advance = useCallback(() => {
    setFlash(null);
    Object.values(screensRef.current).forEach((x) => x.stayBlack());
    onFocusAgent?.(PITCHER_AGENT);
    setRun((r) => doAdvance(r, deal));
  }, [deal, onFocusAgent]);

  const callIt = useCallback(() => {
    setFlash(null);
    setRun((r) => doCallIt(r, deal));
  }, [deal]);

  const lockCall = useCallback(() => setRun((r) => doAllocate(r, deal, slider)), [deal, slider]);
  const finish = useCallback(() => setRun((r) => toAutopsy(r)), []);

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
        <div className="ps-deal">
          {identity
            ? <>{deal.ticker} · {deal.name} <span className="ps-dim">· {deal.chain}</span></>
            : <span className="ps-dim">ONE DEAL · NOT IN YET</span>}
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

          {/* THE ARRIVAL, THEN THE SHEET. The deal is picked fresh for this
              sitting — nobody decided it before you got here — and you can't
              ask for a different one without leaving. The plate is a status
              readout, never a button.

              The hero is no longer locked to TradingCard's 744x1038 portrait
              box, which is why this column can finally be the width the copy
              wants instead of the width a card was. */}
          <div className="ps-open-hero">
            <div className="ps-roll">
              <EnigmaConsole arrived={rolled} ref={panelRef}
                             lampRef={lampRef} registerRotor={registerRotor} />
              {/* The caption names WHO chose, which is the one thing the old
                  dice could never say. It read "THE DEAL IS ROLLED, NOT CHOSEN"
                  — and the deal is in fact chosen, by Our Lady, which is why the
                  randomiser had to become a person. */}
              {/* ONLY IN THE ARRIVED STATE — see the note in PressFlat. */}
              {rolled && (
                <div className="ps-roll-cap">
                  SENT DOWN TO YOU · YOU DON&apos;T GET TO ASK WHY THIS ONE
                </div>
              )}
            </div>

            {/* Written in only once the agent is in. Every field here is public
                surface data and none of it correlates with the outcome — that's
                asserted in the suite, because the moment the listing leaks the
                answer the analysts stop mattering. */}
            <div className={`ps-sheet${identity ? " in" : ""}`} ref={sheetRef}>
              {identity ? (
                <>
                  <div className="ps-sheet-h">PROSPECT</div>
                  <div className="ps-sheet-name">{deal.name}</div>
                  <div className="ps-sheet-tick">{deal.ticker} · {deal.chain}</div>
                  <dl className="ps-sheet-stats">
                    <div><dt>MCAP</dt><dd>{deal.surface.mcap}</dd></div>
                    <div><dt>HOLDERS</dt><dd>{deal.surface.holders}</dd></div>
                    <div><dt>AGE</dt><dd>{deal.surface.age}</dd></div>
                    <div><dt>24H</dt><dd>{deal.surface.change24h}</dd></div>
                    <div><dt>SOCIAL</dt><dd>{deal.surface.social}</dd></div>
                  </dl>
                  <div className="ps-sheet-foot">
                    Long, short, or hold? Work the questions. Then commit.
                  </div>
                </>
              ) : (
                <div className="ps-sheet-blank">NOTHING ON THE TABLE YET</div>
              )}
            </div>

          </div>

          <div className="ps-open-copy">
            <div className="ps-open-eyebrow">ONE DEAL ON THE TABLE</div>
            {/* THE DECODE LANDS HERE. runArrival writes ciphertext into this
                node and resolves it to deal.name; React then renders the same
                string once `identity` flips, so the re-render is a no-op. */}
            <div className={`ps-open-name${identity ? "" : " facedown"}`} ref={nameRef}>
              {identity ? deal.name : "\u259a\u259a\u259a\u259a\u259a\u259a\u259a\u259a"}
            </div>
            <div className="ps-open-sub">
              {identity
                ? `${deal.ticker} · ${deal.chain} · ${deal.surface.age} old · ${deal.surface.mcap}`
                : "sent down from the desk above, still coded"}
            </div>
            {/* Unnamed until the agent is in. The two versions are deliberately
                the same shape so the swap reads as the name filling in, not as
                the paragraph rewriting itself. */}
            {/* The pitcher is an outside agent on commission, not a colleague.
                This copy said "John Barron brought this one in — it's his deal"
                until 2026-07-29, which stopped being true when the bot took over
                the selling and Barron joined the desk as a plain specialist. */}
            <div className="ps-open-body">
              An agent is here for a client who didn&apos;t come. It gets paid if you
              fund this, and it&apos;s going to talk for about two minutes.
            </div>
            <div className="ps-open-rule">
              You can interrupt <b>three times</b> and make it put a number on
              things. Whatever it can actually back lands on a screen. Whatever it
              can&apos;t, doesn&apos;t.
            </div>

            {/* THE DESK. Portraits, not card faces — a card is a thing you
                look at, and four in a row read as a cast list even when they
                were the controls (see the note on SeatRow in pressUi.jsx).
                Nothing here is clickable: on the briefing they are an
                introduction, and the sendable version of the same four is the
                seat row on the floor. */}
            <div className="ps-tools">
              <div className="ps-tool-group ps-tool-hand">
                <div className="ps-draw-label">THE DESK — always these four, and the cat</div>
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
                {/* ALL FOUR ARE SCARCE NOW. This read "Marisol, GR80 and Eugene
                    answer once each" while Barron was the pitcher and therefore
                    unlimited. He is a seat like the rest since 2026-07-29 — the
                    desk has no exceptions left. */}
                <div className="ps-open-rule" style={{ marginTop: 10 }}>
                  Everyone at this desk will answer anything you ask them. Each has{" "}
                  <b>one</b> subject they go deep on, and each answers{" "}
                  <b>once</b>, all session. Ask the wrong one and you still get an
                  answer; you just get the shallow version, and you&apos;ve spent them.
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
                    dice cut. The flat surface was updated at the time and this
                    one was missed. */}
                {rolled ? "HEAR THE PITCH ▸" : rolling ? "DECODING…" : "SEND IT IN ▸"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ---------- the floor ---------- */}
      {onFloor && claim && (
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
            {flash && flash.id === claim.id && <AnswerBody flash={flash} />}

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
          <div className="ps-slider-ends"><span>SHORT</span><span>FLAT</span><span>LONG</span></div>
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
          <button className="ps-lower-go" onClick={finish}>WHAT HE ACTUALLY SAID ▸</button>
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

const CSS = ARRIVAL_CSS + PRESS_UI_CSS + `
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
.ps-readcol { position:absolute; left:18px; bottom:46px; width:min(430px, 38vw);
  max-height:calc(100vh - 130px); overflow-y:auto;
  display:flex; flex-direction:column; gap:8px; }
/* Over the room, so both blocks are opaque enough to read against anything. */
.ps-readcol .pu-claim { background:rgba(2,16,14,0.86); }
.ps-readcol .pu-answer { animation:psin .25s ease both; }
@keyframes psin { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
/* The claim fades in with the camera cut; the answer has its own entrance. */
.ps-fade { opacity:0; transform:translateY(8px);
  transition:opacity .22s ease, transform .22s ease; }
.ps-fade.in { opacity:1; transform:none; }

.ps-dock { position:absolute; right:18px; bottom:46px; left:auto;
  display:flex; flex-direction:column; align-items:stretch; gap:9px;
  padding:11px 12px; background:rgba(2,16,14,0.9);
  border:1px solid rgba(47,214,214,0.25); }
.ps-dock .pu-meter { justify-content:flex-end; }

.ps-progress { position:absolute; left:18px; bottom:34px; display:flex; gap:6px; }
.ps-dot { width:22px; height:3px; background:rgba(234,255,249,0.18); }
.ps-dot.past { background:rgba(234,255,249,0.4); }
.ps-dot.now { background:#2fd6d6; }
.ps-dot.hit { background:#ffd23a; }
.ps-dot.black { background:#7a8b86; }

.ps-open { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(940px, calc(100vw - 40px)); max-height:90vh; overflow:auto;
  background:rgba(2,16,14,0.93);
  border:1px solid rgba(47,214,214,0.4); border-left:3px solid #ff5f9e; padding:18px 22px;
  display:flex; gap:22px; align-items:flex-start; }
/* align-self keeps the hero from stretching to the copy column's height and
   vice-versa — an earlier version let one column drive the other and the panel
   silently grew to 1355px, scrolling the hand out of sight. */
/* WIDTH IS NOW A CHOICE. This column used to be whatever TradingCard's
   744x1038 box came to at CARD_HERO scale (~298px), and the empty slot waiting
   for that card was the largest object in the briefing — a dashed rectangle
   holding 40% of the panel and saying nothing. The deal sheet is sized to its
   own content instead. */
.ps-open-hero { flex:none; align-self:flex-start; width:250px;
  display:flex; flex-direction:column; gap:14px; }
.ps-roll { display:flex; flex-direction:column; align-items:center; gap:9px;
  padding:16px 10px; border:1px solid rgba(47,214,214,0.22);
  background:rgba(0,0,0,0.25); }
.ps-roll-cap { font-size:8.5px; letter-spacing:0.14em; font-weight:bold;
  color:rgba(255,210,58,0.75); text-align:center; line-height:1.4; }

/* THE DEAL SHEET — what the agent brought. Held at opacity 0 until the arrival
   completes (runArrival tweens it), so no field can name the deal early. */
/* NOT opacity:0 at rest — that took the pre-roll placeholder with it and left a
   hole in the column. runArrival's fromTo does the reveal. */
.ps-sheet { border:1px solid rgba(47,214,214,0.35); border-top:2px solid #ff5f9e;
  background:rgba(0,0,0,0.35); padding:13px 14px 12px; }
.ps-sheet-h { font-size:8.5px; letter-spacing:0.2em; font-weight:bold; color:#ff5f9e; }
.ps-sheet-name { font-size:16px; font-weight:bold; letter-spacing:0.04em;
  margin-top:5px; line-height:1.2; }
.ps-sheet-tick { font-size:10px; letter-spacing:0.08em;
  color:rgba(234,255,249,0.55); margin-top:3px; }
.ps-sheet-stats { margin:11px 0 0; display:flex; flex-direction:column; gap:4px;
  border-top:1px solid rgba(47,214,214,0.2); padding-top:9px; }
.ps-sheet-stats > div { display:flex; align-items:baseline; gap:8px; }
.ps-sheet-stats dt { font-size:9px; letter-spacing:0.13em;
  color:rgba(234,255,249,0.45); width:62px; flex:none; }
.ps-sheet-stats dd { margin:0; font-size:11.5px; font-weight:bold; color:#eafff9; }
.ps-sheet-foot { font-size:10px; line-height:1.45; color:#ffd23a; margin-top:11px;
  padding-top:9px; border-top:1px solid rgba(255,210,58,0.2); }
.ps-sheet-blank { font-size:10px; letter-spacing:0.16em; font-weight:bold;
  color:rgba(234,255,249,0.28); text-align:center; padding:26px 0; }

/* MEASURE. At the panel's 940px this column ran ~965px of monospace per line,
   which is roughly twice a comfortable read. The hero takes a fixed 250 and
   this one is capped, so the copy stays in the 60-75ch band at every width. */
.ps-open-copy { flex:1; min-width:0; max-width:62ch; align-self:flex-start;
  overflow-wrap:anywhere; }
.ps-open-eyebrow { font-size:10px; letter-spacing:0.18em; color:#ff5f9e; font-weight:bold; }
.ps-open-name { font-size:24px; font-weight:bold; letter-spacing:0.06em; margin-top:6px; }
.ps-open-sub { font-size:11px; letter-spacing:0.08em; color:rgba(234,255,249,0.5); margin-top:4px; }
.ps-open-body { font-size:13px; line-height:1.5; margin-top:12px; }
.ps-open-rule { font-size:13px; line-height:1.5; margin-top:9px; color:#ffd23a; }
.ps-open-rule b { color:#fff; }

/* the other four, small, beneath the copy */
.ps-tools { display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;
  margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,210,58,0.22); }
.ps-tool-group { flex:none; }
.ps-tool-hand { flex:1; min-width:0; padding-left:0; border-left:none; }
.ps-draw-label { font-size:9px; letter-spacing:0.13em; color:rgba(255,210,58,0.8);
  font-weight:bold; margin-bottom:7px; }
.ps-draw-row { display:flex; gap:9px; flex-wrap:wrap; }

/* THE DESK, as people rather than card faces. Not buttons: on the briefing
   these introduce the four, and the sendable version is SeatRow on the floor.
   Fixed width so four tiles hold one row and the names can't ragged-wrap. */
.ps-face { flex:none; width:84px; display:flex; flex-direction:column;
  align-items:center; gap:4px; text-align:center; }
.ps-face-pic { width:52px; height:52px; object-fit:cover; border-radius:50%;
  border:1px solid rgba(47,214,214,0.35); background:#020f0d; }
/* Two lines reserved for every name — "Detective Marisol" wraps and the other
   three don't, which put her role label a line below everyone else's. */
.ps-face-who { font-size:9px; font-weight:bold; letter-spacing:0.04em;
  color:rgba(234,255,249,0.92); line-height:1.2; min-height:2.4em;
  display:flex; align-items:center; justify-content:center; }
.ps-face-role { font-size:8px; letter-spacing:0.11em; color:rgba(255,210,58,0.75); }

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

/* THE ARRIVAL — plate styles come from arrival's ARRIVAL_CSS, appended at the
   end of this sheet. What's local to this surface is the skip target. */
.ps-skip-deal { position:absolute; inset:0; z-index:5; background:none; border:none;
  padding:0; cursor:pointer; }
.ps-cta-row { display:flex; align-items:center; gap:14px; margin-top:6px; }
.ps-cta-row .ps-lock { flex:1; width:auto; margin-top:0; }


/* The deal is nameless until the agent is in (invariant 7). Sized the same in
   both states so the reveal doesn't jump. */
.ps-open-name.facedown { color:rgba(234,255,249,0.3); letter-spacing:0.14em; }

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

@media (max-width: 860px) {
  /* The reading column and the dock stop competing for the width and stack. */
  .ps-readcol { width:calc(100% - 36px); right:18px; max-height:38vh; }
  .ps-open { flex-direction:column; }
  .ps-open-hero { align-self:center; }
  .ps-tool-hand { padding-left:0; border-left:none; }
  .ps-tools { flex-direction:column; gap:12px; }
  .ps-tool-who { border-right:none; padding-right:0; }
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
