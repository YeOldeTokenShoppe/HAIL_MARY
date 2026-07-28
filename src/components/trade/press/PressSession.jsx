"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, dailySeed } from "@/game/terminal-traders/press/instanceDeal";
import { BACKING, SEATS, SPENDABLE_SEATS, LANES } from "@/game/terminal-traders/press/questions";
import { DESK, EUGENE, eugeneRead, laneSentence, barronAside } from "@/game/terminal-traders/press/desk";
import {
  PHASE, PRESSES, STAKE,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, coverageScore, seatOptions, laneOutlook, pressure,
} from "@/game/terminal-traders/press/pressRun";
import { toDealCard, toExemplarCard, toCharacterCard } from "@/game/terminal-traders/press/dealCard";
import TradingCard from "@/components/TradingCard";
import { preloadSfx } from "@/lib/uiSfx";
import {
  DealtSlot, DealDeck, runCardDeal, prefersReducedMotion, SFX, DEAL_CSS,
} from "./cardDeal";
import { createEvidenceScreen } from "./evidenceScreen";
import {
  canPress as pressIsLegal, ClaimBody, AnswerBody, SeatRow, Meter, Nav, PRESS_UI_CSS,
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

// A card NEVER opens a new subject — it interrogates a claim HE raised, just
// from a sharper angle. If cards could introduce topics he never mentioned the
// game would become a hunt for hidden subjects rather than a read on the ones
// already in front of you. PRESS HIM is the blunt version of the same move.

const SPEAKER_AGENT = "Demon";    // John Barron's agentId in CyborgTempleScene
const SPEAKER_TRADER  = "john-barron"; // his Genesis card — the CHARACTER type
const SPEAKER_STATION = "demon";  // -> __screen2Canvas (SCREEN_TARGETS in evidenceScreen.js)
const CARD_HERO  = 0.40;   // the deal card — the subject, fills the left column
const CARD_THUMB = 0.115;  // character + questions — context, click to enlarge
const READ_MS = 4200;           // how long a claim holds the floor before it can land

// THE DEAL — choreography lives in ./cardDeal, shared with PressFlat so both
// presentations deal the same way. Deal order is the slot index: 0 the deal
// card, 1 Barron, 2-4 your questions.

export default function PressSession({
  // Pass a deal to pin one (tests/sims). Otherwise the DAILY deal is used —
  // one seeded instance per UTC day, identical for every player, memorisable
  // by nobody. `?dealseed=N` forces a specific one, which is the only way to
  // replay a known rug or a known legit while tuning.
  deal: dealOverride = null,
  onFocusAgent,
  onSpeechActive,
  onRevealChange,
  onExit,
}) {
  // Resolve the deal once per mount. Reading the override here (not at module
  // scope) keeps this SSR-safe and lets a refresh pick up a new ?dealseed.
  const deal = useMemo(() => {
    if (dealOverride) return dealOverride;
    const forced = typeof window !== "undefined"
      ? Number(new URLSearchParams(window.location.search).get("dealseed"))
      : NaN;
    return instanceDeal(Number.isFinite(forced) && forced > 0 ? forced : dailySeed());
  }, [dealOverride]);

  // Your hand for this deal — dealt from the same seed, so it's the same for
  // everyone today and can't be rerolled. `liveShapes` guarantees at least
  // MIN_LIVE of them can hit something here: you can be dealt a question this
  // deal is immune to, but never a whole hand of them.
  // THE DESK. Four people, always the same four — nothing to deal here, so the
  // cards are simply present. Only the deal itself is unknown, and that's the
  // one card that still turns over.
  const DESK_ORDER = useMemo(() => [
    { ...DESK[SEATS.BARRON], cardId: "john-barron" },
    { ...DESK[SEATS.MARISOL], cardId: "marisol" },
    { ...DESK[SEATS.GR80], cardId: "gr80" },
    { ...EUGENE, cardId: "eugene" },
  ], []);

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
  // Full-size card inspect. Thumbs stay small so the layout breathes; anything
  // you actually want to READ (the art, the printed question) is one click away.
  const [inspect, setInspect] = useState(null);
  const screenRef = useRef(null);
  // One board per seat, each painted onto that character's OWN monitor in the
  // scene via the evidenceActive handshake. Eugene has none — he never stamps.
  const screensRef = useRef({});

  // The deal. `dealt` gates the panel's CTA: you deal the table, THEN you let
  // him pitch. Two beats, because being handed a hand is the moment the
  // session starts belonging to you.
  const [dealt, setDealt] = useState(false);
  const [dealing, setDealing] = useState(false);
  // NOTHING ON THIS PANEL MAY NAME A CARD THAT ISN'T FACE-UP YET. Printing
  // "ALDERMAN · $ALDR · $7.5M" and "John Barron brought this one in" over an
  // empty table announced both the deal and the speaker before either had been
  // dealt — which is precisely the reveal this beat exists to stage.
  //
  // `landed` counts cards that have finished turning over, in deal order, so
  // each name arrives with its own card: the deal's identity when slot 0 lands,
  // the speaker's when slot 1 does.
  const [landed, setLanded] = useState(0);
  const identity = dealt || landed >= 1;      // slot 0 — the deal card
  const speakerNamed = dealt || landed >= 2;  // slot 1 — who's pitching
  const deckRef = useRef(null);
  const slotRefs = useRef([]);
  const tlRef = useRef(null);
  const registerSlot = useCallback((i, el) => { slotRefs.current[i] = el; }, []);

  const claim = currentClaim(run, deal);
  const onFloor = started && run.phase === PHASE.FLOOR;

  /* ---- the evidence screen ----
     We don't own a texture. VideoScreens already owns the seat's mesh, canvas
     and material; we borrow the canvas through the EvidenceScreens handshake
     and hand it back on unmount. See evidenceScreen.js for why. */
  useEffect(() => {
    const s = createEvidenceScreen({ station: SPEAKER_STATION, header: "BARRON" });
    screenRef.current = s;
    const made = { [SEATS.BARRON]: s };
    for (const seat of SPENDABLE_SEATS) {
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

  /* ---- camera + animation: he's talking, so look at him ---- */
  useEffect(() => {
    if (!onFloor) return;
    onFocusAgent?.(SPEAKER_AGENT);
    onSpeechActive?.(true);
    return () => onSpeechActive?.(false);
  }, [onFloor, run.claimIndex, onFocusAgent, onSpeechActive]);

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

  const runDeal = useCallback(() => {
    if (dealing || dealt) return;
    // Someone who asked not to be moved gets the cards, not the choreography.
    if (prefersReducedMotion()) { setDealt(true); return; }

    setDealing(true);
    const tl = runCardDeal({
      deck: deckRef.current,
      slots: slotRefs.current,
      captionSelector: ".ps-draw-name",
      onLanded: (i) => setLanded((n) => Math.max(n, i + 1)),
      onDone: () => { setDealing(false); setDealt(true); },
    });
    // Nothing to animate — go straight to the dealt state rather than
    // stranding the player on a button that does nothing.
    if (!tl) { setDealing(false); setDealt(true); return; }
    tlRef.current = tl;
  }, [dealing, dealt]);

  // Impatience is a legitimate input: a click anywhere mid-deal lands the rest
  // of the hand instantly instead of making you sit through it.
  const skipDeal = useCallback(() => {
    if (dealing) tlRef.current?.progress(1);
  }, [dealing]);

  /* ---- actions ---- */
  // One path, three seats. Barron is reusable; the two advisers are one use
  // each and only in their own lane. The room enforces it — an illegal send is
  // a no-op, so a misclick can never cost you a session.
  const press = useCallback((seat = SEATS.BARRON) => {
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
      asked: outcome.seat === SEATS.BARRON
        ? "Put a number on it."
        : `${DESK[outcome.seat].name} — ${DESK[outcome.seat].role}`,
    });

    // THE ANSWER LANDS ON WHOEVER WENT AND GOT IT — on their own monitor, in
    // the room. That's the whole reason this design is worth the four seats:
    // three boards lit differently at the moment you call it is a picture only
    // this scene can render.
    const board = screensRef.current[outcome.board];
    if (outcome.receipt) board?.stamp(outcome.receipt);
    else if (outcome.nothingOnFile) board?.stampNothing(claim.subject);
    else board?.stayBlack();

    // Fly to whoever answered. An adviser sent is a cut across the desk.
    onFocusAgent?.(DESK[outcome.seat].agentId);
  }, [run, deal, claim, onFloor, onFocusAgent]);

  const advance = useCallback(() => {
    setFlash(null);
    Object.values(screensRef.current).forEach((x) => x.stayBlack());
    onFocusAgent?.(SPEAKER_AGENT);
    setRun((r) => doAdvance(r, deal));
  }, [deal, onFocusAgent]);

  const callIt = useCallback(() => {
    setFlash(null);
    setRun((r) => doCallIt(r, deal));
  }, [deal]);

  const lockCall = useCallback(() => setRun((r) => doAllocate(r, deal, slider)), [deal, slider]);
  const finish = useCallback(() => setRun((r) => toAutopsy(r)), []);

  const dealCard = useMemo(() => toDealCard(deal), [deal]);
  const patternCard = useMemo(() => toExemplarCard(deal), [deal]);
  // All three card types, rendered through the one Genesis renderer.
  const deskCards = useMemo(
    () => DESK_ORDER.map((m) => ({ m, data: toCharacterCard(m.cardId, m.role) })), [DESK_ORDER]);
  const speakerCard = deskCards[0]?.data;
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
    () => barronAside(mood.band, claim, run.claimIndex),
    [mood.band, claim, run.claimIndex]);
  // Reads the run, not just the claim — once you've spent the lane's owner,
  // pointing at them is the same wrong instruction the lane band was giving.
  const eugeneLine = useMemo(
    () => (claim ? eugeneRead(claim, { spent: run.advisersSpent, remaining: outlook.remaining }) : ""),
    [claim, run.advisersSpent, outlook.remaining]);
  const eugeneCard = useMemo(
    () => deskCards.find((d) => d.m.id === EUGENE.id)?.data ?? null, [deskCards]);
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

      {/* Full-size card inspect. Click-anywhere to dismiss, matching the
          DealHand/binder pattern already in the codebase. */}
      {inspect && (
        <div className="ps-inspect" onClick={() => setInspect(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TradingCard data={inspect} scale={0.5} interactive templateStyle="terminal" />
          </div>
          <button className="ps-inspect-close" onClick={() => setInspect(null)}>✕ CLOSE</button>
        </div>
      )}

      {/* ---------- top bar: always visible, never blocks the room ---------- */}
      <div className="ps-bar">
        <button className="ps-exit" onClick={onExit}>◀ LEAVE THE DESK</button>
        {/* The bar names the deal only once the deal has a face. It sits above
            the panel and in bigger type, so leaving it live would spoil the
            reveal more loudly than the headline the panel withholds. */}
        <div className="ps-deal">
          {identity
            ? <>{deal.ticker} · {deal.name} <span className="ps-dim">· {deal.chain}</span></>
            : <span className="ps-dim">ONE DEAL · FACE DOWN</span>}
        </div>
        <div className="ps-book">
          BOOK <b>{Math.round(run.book)}</b>
        </div>
      </div>

      {/* ---------- the opening: the room, then the deal ---------- */}
      {!started && (
        <div className={`ps-open${dealt ? " is-dealt" : ""}${dealing ? " is-dealing" : ""}`}>
          {/* Deal card fills the left. Copy right. The other four — who's
              pitching, and the three questions you drew — sit small beneath
              the copy. Everything is click-to-enlarge, once it's landed. */}

          {/* Mid-deal, a click anywhere lands the rest. This has to be a real
              <button> to be clickable at all: .ps-root is pointer-events:none
              and hands input only to buttons and inputs. */}
          {dealing && (
            <button className="ps-skip-deal" onClick={skipDeal} aria-label="Deal the rest now" />
          )}

          <div className="ps-open-hero">
            {dealCard && (
              <button className="ps-hero-card" onClick={() => setInspect(dealCard)}
                      title={`${deal.name} — click for full size`}>
                <DealtSlot index={0} scale={CARD_HERO} register={registerSlot}>
                  <TradingCard data={dealCard} scale={CARD_HERO} interactive templateStyle="terminal" />
                </DealtSlot>
              </button>
            )}
          </div>

          <div className="ps-open-copy">
            <div className="ps-open-eyebrow">ONE DEAL ON THE TABLE</div>
            <div className={`ps-open-name${identity ? "" : " facedown"}`}>
              {identity ? deal.name : "FACE DOWN"}
            </div>
            <div className="ps-open-sub">
              {identity
                ? `${deal.ticker} · ${deal.chain} · ${deal.surface.age} old · ${deal.surface.mcap}`
                : "the house hasn't turned it over yet"}
            </div>
            {/* Unnamed until his card is down. The two versions are
                deliberately the same shape so the swap reads as the name
                filling in, not as the paragraph rewriting itself. */}
            <div className="ps-open-body">
              {speakerNamed
                ? "John Barron brought this one in. It's his deal — if you fund it, he gets paid. He's going to talk for about two minutes."
                : "Someone at this desk brought this one in. It's their deal — if you fund it, they get paid. They're going to talk for about two minutes."}
            </div>
            <div className="ps-open-rule">
              You can interrupt {speakerNamed ? "him" : "them"} <b>three times</b> and make{" "}
              {speakerNamed ? "him" : "them"} put a number on it. Whatever{" "}
              {speakerNamed ? "he" : "they"} can actually back lands on{" "}
              {speakerNamed ? "his" : "their"} screen. Whatever {speakerNamed ? "he" : "they"} can't,
              doesn't.
            </div>

            <div className="ps-tools">
              <div className="ps-tool-group ps-tool-hand">
                <div className="ps-draw-label">THE DESK — always these four</div>
                <div className="ps-draw-row">
                  {deskCards.map(({ m, data }) => (
                    <button key={m.id} className="ps-draw-card" onClick={() => setInspect(data)}
                            title={`${m.name} — click for full size`}>
                      <TradingCard data={data} scale={CARD_THUMB} interactive={false} templateStyle="terminal" />
                      <span className="ps-draw-name">{m.role}</span>
                    </button>
                  ))}
                </div>
                <div className="ps-open-rule" style={{ marginTop: 10 }}>
                  Marisol and GR80 each answer <b>one</b> claim, in their own lane.
                  Barron you can press as often as you like. Eugene reads every claim for free.
                </div>
              </div>
            </div>

            {/* The deck and the one live control. My seat-row rewrite replaced
               the whole tools block and took this with it, which left the
               briefing with nothing to press — "there is no deal specified or
               buttons to push" (author, 2026-07-27). */}
            <div className="ps-cta-row">
              <DealDeck ref={deckRef} spent={dealt || dealing} />
              <button
                className="ps-lock"
                onClick={dealt ? () => setStarted(true) : runDeal}
                disabled={dealing}
              >
                {dealt ? "LET HIM PITCH ▸" : dealing ? "DEALING…" : "DEAL ME IN ▸"}
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
              <ClaimBody claim={claim} eugeneLine={eugeneLine} eugeneCard={eugeneCard}
                       pressure={mood} aside={aside}
                         spent={run.advisersSpent} />
            </div>
            {flash && flash.id === claim.id && <AnswerBody flash={flash} />}
          </div>

          {/* The controls, grouped bottom-right and clear of the reading
              column on the left. */}
          <div className="ps-dock">
            <SeatRow live={live} pressed={pressed} options={options}
                     deskCards={deskCards} onPress={press} scale={0.1} />
            <Meter run={run} presses={PRESSES} />
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
          <div className="ps-panel-h">THE AUTOPSY</div>
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
            {patternCard && (
              <div className="ps-pattern">
                <div className="ps-pattern-card">
                  <TradingCard data={patternCard} scale={0.22} interactive={false} templateStyle="terminal" />
                </div>
                <div className="ps-pattern-copy">
                  <div className="ps-pattern-label">YOU'VE SEEN THIS SHAPE BEFORE</div>
                  <div className="ps-pattern-name">{deal.exemplar.name}</div>
                  <div className="ps-pattern-note">{deal.exemplar.note}</div>
                  <div className="ps-pattern-foot">
                    Same read, different token. Learn the shape and you get every one of these.
                  </div>
                </div>
              </div>
            )}
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

const CSS = DEAL_CSS + PRESS_UI_CSS + `
/* FIXED, not absolute: this portals into document.body, which on /trade is
   taller than the viewport — an absolute inset:0 stretched the layer down the
   whole page and pushed the dock off-screen. */
.ps-root { position:fixed; inset:0; z-index:10050; pointer-events:none;
  font-family:'Courier New', monospace; color:#eafff9; }
.ps-root button, .ps-root input { pointer-events:auto; font-family:inherit; }
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
.ps-open-hero { flex:none; align-self:flex-start; }
.ps-hero-card { background:none; border:none; padding:0; cursor:zoom-in; display:block;
  transition:transform .12s ease; }
.ps-hero-card:hover { transform:translateY(-3px); }
.ps-open-copy { flex:1; min-width:0; max-width:100%; align-self:flex-start; overflow-wrap:anywhere; }
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
.ps-draw-card { flex:none; background:none; border:none; padding:0; cursor:zoom-in;
  display:flex; flex-direction:column; align-items:center; gap:4px;
  transition:transform .12s ease; }
.ps-draw-card:hover { transform:translateY(-3px); }

/* THE DEAL — slot/deck/flip styles come from cardDeal's DEAL_CSS, appended at
   the end of this sheet. What's local to this surface is who may be clicked
   and where the deck sits. Landed cards are inspectable; in-flight ones aren't,
   and neither is an empty table — clicking a slot holding nothing must do
   nothing. */
.ps-open:not(.is-dealt) .ps-hero-card,
.ps-open:not(.is-dealt) .ps-draw-card { pointer-events:none; }
.ps-open.is-dealt .deal-fly { opacity:1; }
.ps-open.is-dealt .deal-ghost { opacity:0; }
.ps-skip-deal { position:absolute; inset:0; z-index:5; background:none; border:none;
  padding:0; cursor:pointer; }
.ps-cta-row { display:flex; align-items:center; gap:14px; margin-top:6px; }
.ps-cta-row .ps-lock { flex:1; width:auto; margin-top:0; }

/* full-size inspect */
.ps-inspect { position:fixed; inset:0; z-index:10060; display:flex; flex-direction:column;
  gap:14px; align-items:center; justify-content:center; padding:16px; overflow:auto;
  background:rgba(2,10,9,0.9); backdrop-filter:blur(4px); pointer-events:auto; }
.ps-inspect-close { background:none; border:1px solid rgba(47,214,214,0.5); color:#2fd6d6;
  font-size:11px; letter-spacing:0.1em; padding:9px 16px; cursor:pointer; }

/* Captions are held back with the cards they name — a labelled empty slot
   tells you what you were dealt before you were dealt it. opacity, not
   display, so nothing reflows when they arrive. */
.ps-draw-name { font-size:8.5px; letter-spacing:0.1em; font-weight:bold;
  color:rgba(234,255,249,0.65); opacity:0; }
.ps-open.is-dealt .ps-draw-name { opacity:1; }
/* Same withholding for the headline: the deal is nameless until its card is
   face-up. Sized the same in both states so the reveal doesn't jump. */
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
.ps-pattern-card { flex:none; line-height:0; }
.ps-pattern-copy { flex:1; min-width:0; }
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
