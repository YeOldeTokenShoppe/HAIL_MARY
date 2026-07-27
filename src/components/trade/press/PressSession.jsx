"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { instanceDeal, dailySeed } from "@/game/terminal-traders/press/instanceDeal";
import { ANY, BACKING } from "@/game/terminal-traders/press/questions";
import { dealHand } from "@/game/terminal-traders/press/hand";
import {
  PHASE, PRESSES, STAKE,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, readScore,
} from "@/game/terminal-traders/press/pressRun";
import { toDealCard, toExemplarCard, toQuestionCard, toCharacterCard } from "@/game/terminal-traders/press/dealCard";
import TradingCard from "@/components/TradingCard";
import { playSfx, preloadSfx } from "@/lib/uiSfx";
import { createEvidenceScreen } from "./evidenceScreen";

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

/* ---- THE DEAL ----
   The five cards used to materialise with a CSS stagger the moment the panel
   opened, which read as "the page finished loading" rather than "you were dealt
   a hand". Now the table starts empty and YOU deal it.

   The flight is a hand-rolled FLIP: every card stays in its real DOM slot (so
   the layout stays authoritative and responsive) and we animate the measured
   DELTA from the deck stub to that slot. Nothing is absolutely positioned into
   place, nothing reflows, and it's pure transform/opacity — which matters,
   because this whole panel renders over the LIVE temple scene.

   Flight and flip ride the SAME element via transformPerspective, so the card
   turns identically wherever it is mid-air. (Perspective on the parent instead
   would skew the flip harder the further the card is from its slot.) */
// Deal order is the slot index: 0 the deal card, 1 Barron, 2-4 your questions.
const DEAL_STAGGER = 0.16; // gap between cards leaving the deck
const DEAL_FLIGHT  = 0.66; // deck -> slot
const DEAL_FLIP_AT = 0.30; // into the flight, when it starts turning face-up
const DEAL_FLIP_DUR = 0.46;
const CARD_W = 744, CARD_H = 1038;   // TradingCard's native box, before --scale

const SFX = {
  deal: "/audio/card_flip.mp3",       // per card, as it comes off the deck
  // Optional deck riffle under the button press. playSfx no-ops safely on a
  // missing file (uiSfx caches the failed fetch, the element fallback swallows
  // the rest), so this lights up by itself the moment a file lands here.
  shuffle: "/audio/card_shuffle.mp3",
};
// Measured, not guessed: card_flip.mp3 is -26.1 LUFS, ~2dB under
// /audio/proceed.mp3, which CyberButton plays at 1.0 — so one hit would sit
// near 1.0. But this fires five times inside 1.3s, so it opens at 0.8 and eases
// down across the deal: the hand settles instead of machine-gunning.
const SFX_DEAL_VOL = 0.8, SFX_DEAL_DECAY = 0.07;

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
  const hand = useMemo(() => {
    const live = new Set(deal.claims.map((c) => c.shape));
    return dealHand(Number(String(deal.id).split(":")[1]) || 1, live);
  }, [deal]);

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
    return () => { s.dispose(); screenRef.current = null; };
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

  /* ---- the deal ----
     Measure at CLICK time, never at mount: the panel is fully laid out by the
     time anyone can press the button, so every rect is honest and there is no
     load-order race to lose. (This is the same reason `started` is a click and
     not a timer — see the note on that state above.) */
  useEffect(() => { Object.values(SFX).forEach(preloadSfx); }, []);
  useEffect(() => () => tlRef.current?.kill(), []);

  const runDeal = useCallback(() => {
    if (dealing || dealt) return;
    const deck = deckRef.current;
    const slots = slotRefs.current.filter(Boolean);
    // No deck or no cards to move: skip straight to the dealt state rather
    // than stranding the player on a button that does nothing.
    if (!deck || !slots.length) { setDealt(true); return; }

    // Someone who asked not to be moved gets the cards, not the choreography.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      setDealt(true);
      return;
    }

    setDealing(true);
    playSfx(SFX.shuffle, { volume: 0.55 });

    const dk = deck.getBoundingClientRect();
    const tl = gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => {
        setDealing(false);
        setDealt(true);
        // Hand the elements back untransformed. Leaving an inline transform
        // behind would keep five composited layers alive over a live WebGL
        // scene for the rest of the session.
        gsap.set(slots.map((s) => s.querySelector(".ps-fly")), {
          clearProps: "transform,willChange",
        });
      },
    });
    tlRef.current = tl;

    slots.forEach((slot, i) => {
      const fly = slot.querySelector(".ps-fly");
      const ghost = slot.querySelector(".ps-slot-ghost");
      if (!fly) return;
      const r = slot.getBoundingClientRect();
      // Centre-to-centre, because the flight also scales and scaling happens
      // about the centre — matching corners here would drift by half the
      // size difference, which on the hero card is ~120px.
      const dx = dk.left + dk.width / 2 - (r.left + r.width / 2);
      const dy = dk.top + dk.height / 2 - (r.top + r.height / 2);
      const at = i * DEAL_STAGGER;

      tl.fromTo(fly, {
        x: dx, y: dy,
        scale: r.width ? dk.width / r.width : 0.2,
        rotation: -16 + i * 7,   // fanned, so five cards don't fly in lockstep
        rotationY: 180,          // face-down off the deck
        transformPerspective: 1200,
        opacity: 1,
        willChange: "transform",
      }, {
        x: 0, y: 0, scale: 1, rotation: 0,
        duration: DEAL_FLIGHT, ease: "power3.out",
        // One hit per card, on the launch rather than the landing: the launch
        // is the percussive moment, and firing on both would be ten sounds
        // inside 1.3s.
        onStart: () => playSfx(SFX.deal, {
          volume: Math.max(0.2, SFX_DEAL_VOL - i * SFX_DEAL_DECAY),
        }),
      }, at);

      // It turns over as it arrives, not after — a card that lands and then
      // flips reads as two events instead of one gesture.
      tl.to(fly, {
        rotationY: 0,
        duration: DEAL_FLIP_DUR, ease: "power2.inOut",
        // A card turning over is what unseals whatever names it. (A skip fires
        // these too: progress(1) still runs the callbacks it jumps over.)
        onComplete: () => setLanded((n) => Math.max(n, i + 1)),
      }, at + DEAL_FLIP_AT);

      if (ghost) tl.to(ghost, { opacity: 0, duration: 0.3 }, at + DEAL_FLIP_AT);
      // Each caption arrives with its own card, never before it.
      const cap = slot.parentElement?.querySelector(".ps-draw-name");
      if (cap) tl.to(cap, { opacity: 1, duration: 0.28 }, at + DEAL_FLIP_AT);
    });
  }, [dealing, dealt]);

  // Impatience is a legitimate input: a click anywhere mid-deal lands the rest
  // of the hand instantly instead of making you sit through it.
  const skipDeal = useCallback(() => {
    if (dealing) tlRef.current?.progress(1);
  }, [dealing]);

  /* ---- actions ---- */
  // One press path for both moves — the generic question and a card are the
  // same action, they just say different words. That's the whole design: a
  // card never buys you an extra press, only a better-aimed one.
  const press = useCallback((question = ANY, card = null) => {
    if (!onFloor || run.pressesLeft <= 0 || !claim || run.outcomes[claim.id]) return;
    if (card && run.cardsSpent.includes(card.id)) return;
    const next = doPress(run, deal, question, card?.id ?? null);
    if (next === run) return;
    const outcome = next.outcomes[claim.id];
    setRun(next);
    setFlash({
      id: claim.id,
      line: outcome.line,
      backing: outcome.backing,
      wasted: outcome.wasted,
      named: outcome.named,
      asked: card ? card.question : "Put a number on it.",
      cardName: card?.name || null,
    });
    // The board either records something or it conspicuously does not.
    if (outcome.receipt) screenRef.current?.stamp(outcome.receipt);
    else screenRef.current?.stayBlack();
  }, [run, deal, claim, onFloor]);

  const advance = useCallback(() => {
    setFlash(null);
    setRun((r) => doAdvance(r, deal));
  }, [deal]);

  const callIt = useCallback(() => {
    setFlash(null);
    setRun((r) => doCallIt(r, deal));
  }, [deal]);

  const lockCall = useCallback(() => setRun((r) => doAllocate(r, deal, slider)), [deal, slider]);
  const finish = useCallback(() => setRun((r) => toAutopsy(r)), []);

  const dealCard = useMemo(() => toDealCard(deal), [deal]);
  const patternCard = useMemo(() => toExemplarCard(deal), [deal]);
  // All three card types, rendered through the one Genesis renderer.
  const speakerCard = useMemo(() => toCharacterCard(SPEAKER_TRADER), []);
  const handCards = useMemo(() => hand.map((q) => ({ q, data: toQuestionCard(q) })), [hand]);
  const readout = useMemo(() => callReadout(slider), [slider]);
  const read = useMemo(() => readScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;

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
              <div className="ps-tool-group">
                <div className="ps-draw-label">PITCHING</div>
                <div className="ps-draw-row">
                  {speakerCard && (
                    <button className="ps-draw-card" onClick={() => setInspect(speakerCard)}
                            title="John Barron — click for full size">
                      <DealtSlot index={1} scale={CARD_THUMB} register={registerSlot}>
                        <TradingCard data={speakerCard} scale={CARD_THUMB} interactive={false} templateStyle="terminal" />
                      </DealtSlot>
                      <span className="ps-draw-name">BARRON</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="ps-tool-group ps-tool-hand">
                <div className="ps-draw-label">YOU DREW — three angles, instead of the blunt question</div>
                <div className="ps-draw-row">
                  {handCards.map(({ q, data }, i) => (
                    <button key={q.id} className="ps-draw-card" onClick={() => setInspect(data)}
                            title={`${q.name} — click for full size`}>
                      <DealtSlot index={2 + i} scale={CARD_THUMB} register={registerSlot}>
                        {data
                          ? <TradingCard data={data} scale={CARD_THUMB} interactive={false} templateStyle="terminal" />
                          : <span className="ps-card-name">{q.name}</span>}
                      </DealtSlot>
                      <span className="ps-draw-name">{q.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Two beats. You deal the table, you look at what you got, THEN
                you let him talk. Folding both into one button was the old
                behaviour and it made the hand feel like page furniture. */}
            <div className="ps-cta-row">
              <span className={`ps-deck${dealt || dealing ? " is-spent" : ""}`}
                    ref={deckRef} aria-hidden="true">
                <span className="ps-deck-card" />
                <span className="ps-deck-card" />
                <span className="ps-deck-card" />
              </span>
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
          <div className={`ps-claim ${claimVisible ? "in" : ""}`}>
            <div className="ps-who">JOHN BARRON <span className="ps-dim">— his deal</span></div>
            <div className="ps-spin">“{claim.spin}”</div>
            <div className="ps-chiprow">
              <span className="ps-tag">FACT</span>
              <span className="ps-fact">{claim.fact}</span>
            </div>
          </div>

          {flash && flash.id === claim.id && (
            <div className={`ps-answer ${flash.wasted ? "wasted" : flash.backing === BACKING.VIBES ? "vibes" : ""}`}>
              <div className="ps-answer-asked">YOU ASKED — “{flash.asked}”</div>
              <div className="ps-answer-line">“{flash.line}”</div>
              <div className="ps-answer-note">
                {flash.wasted
                  ? "✕ HE ANSWERED IT. It was true, and it wasn't what you needed."
                  : flash.named
                    ? "▚ STILL BLACK — but now you know what kind of nothing this is."
                    : flash.backing === BACKING.VIBES
                      ? "▚ HIS SCREEN STAYS BLACK. Nothing was recorded."
                      : flash.backing === BACKING.SOFT
                        ? "◍ PARTIAL — something landed on his screen, but not all of it."
                        : "◼ ON RECORD — it's on his screen now. It'll still be there when you call."}
              </div>
            </div>
          )}

          {/* ONE ROW OF QUESTIONS. Playing a card and "pressing" were always
              the same action — a card just swaps the sentence you say. The
              first build split them into a big PRESS button and a separate
              card rack, which read as two mechanics ("i'm confused about the
              cards versus the press button" — author, 2026-07-26). They're one
              row now: the plain question first, always available; the sharper
              ones after it, one use each. */}
          {/* The cards live on the RIGHT, clear of the claim panel on the left.
              The label spells out the relationship the first build left implicit:
              the button and the cards are the same interruption, the cards just
              aim it. (Unifying them into one row fixed the confusion but put a
              card on top of the FACT row — author, 2026-07-26.) */}
          <div className="ps-hand-wrap">
            <div className="ps-ask-label">OR ASK SOMETHING SHARPER — same interruption, better aim</div>
            <div className="ps-hand">
              {hand.map((c) => {
                const spent = run.cardsSpent.includes(c.id);
                const dead = spent || run.pressesLeft <= 0 || !!pressed;
                return (
                  <button
                    key={c.id}
                    className={`ps-card ${spent ? "spent" : ""}`}
                    onClick={() => press(c.shape, c)}
                    disabled={dead}
                    title={c.hint}
                  >
                    <span className="ps-card-name">{c.name}</span>
                    <span className="ps-card-q">“{c.question}”</span>
                    <span className="ps-card-hint">{spent ? "USED" : c.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ps-dock">
            <button
              className="ps-press"
              onClick={() => press(ANY, null)}
              disabled={run.pressesLeft <= 0 || !!pressed}
            >
              <span className="ps-press-main">PRESS HIM</span>
              <span className="ps-press-sub">
                {pressed ? "you've had your answer on this one"
                  : run.pressesLeft <= 0 ? "no interruptions left"
                    : "“put a number on it”"}
              </span>
            </button>

            <div className="ps-meter" aria-label={`${run.pressesLeft} interruptions left`}>
              {Array.from({ length: PRESSES }).map((_, i) => (
                <span key={i} className={`ps-pip ${i < run.pressesLeft ? "live" : ""}`} />
              ))}
              <span className="ps-meter-label">INTERRUPTIONS LEFT</span>
            </div>

            <div className="ps-nav">
              <button className="ps-next" onClick={advance}>
                {run.claimIndex >= deal.claims.length - 1 ? "HEAR HIM OUT ▸" : "LET HIM GO ON ▸"}
              </button>
              <button className="ps-call" onClick={callIt}>CALL IT NOW</button>
            </div>
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
        <div className="ps-panel side scroll">
          <div className="ps-panel-h">THE AUTOPSY</div>
          <div className="ps-scores">
            <div><span className="ps-dim">READ</span><b>{read.hit}/{read.spent || 0}</b></div>
            <div><span className="ps-dim">BOOK</span><b>{Math.round(run.book)}</b></div>
          </div>
          <div className="ps-readnote">{read.note}</div>

          {/* THE PATTERN. The single most portable thing the player leaves with
              — not "MERIDIAN rugged" but "this is what a backdoor-fork looks
              like". The exemplar coin is the collectible worth earning, because
              it's the archetype, not one token's answer. */}
          {patternCard && (
            <div className="ps-pattern">
              <div className="ps-pattern-card">
                <TradingCard data={patternCard} scale={0.34} interactive={false} templateStyle="terminal" />
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
          <button className="ps-lock" onClick={onExit}>LEAVE THE DESK</button>
        </div>
      )}
    </div>
  );
}

/* One dealt card. The slot is a fixed, static box that holds the layout open
   from the moment the panel appears — so the empty table has the right shape
   and nothing shifts when the cards land. `.ps-fly` is the ONLY thing GSAP
   touches: TradingCard drives its own transform on .tc-card (tilt + --scale)
   and the hover lift lives on the .ps-draw-card button, so all three transform
   owners stay on separate elements and never fight.
   Spans, not divs — these render inside <button>, which takes phrasing content. */
function DealtSlot({ index, scale, register, children }) {
  const w = Math.round(CARD_W * scale);
  const h = Math.round(CARD_H * scale);
  return (
    <span className="ps-slot" style={{ width: w, height: h }}
          ref={(el) => register(index, el)}>
      <span className="ps-slot-ghost" aria-hidden="true" />
      <span className="ps-fly">
        <span className="ps-face ps-face-back" aria-hidden="true" />
        <span className="ps-face ps-face-front">{children}</span>
      </span>
    </span>
  );
}

const CSS = `
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

/* the claim — bottom-left, deliberately small so the ROOM stays the picture */
/* bottom:132 clears the dock (which tops out at ~52+62=114) with margin, so the
   PRESS button can never sit on the FACT row again. */
.ps-claim { position:absolute; left:18px; bottom:132px; width:min(430px, 44vw);
  background:rgba(2,16,14,0.82); border-left:2px solid #ff5f9e; padding:12px 14px;
  opacity:0; transform:translateY(8px); transition:opacity .22s ease, transform .22s ease; }
.ps-claim.in { opacity:1; transform:none; }
.ps-who { font-size:10.5px; letter-spacing:0.14em; color:#ff5f9e; font-weight:bold; }
.ps-spin { font-size:14.5px; line-height:1.45; margin:8px 0 10px; }
.ps-chiprow { display:flex; gap:8px; align-items:flex-start;
  border-top:1px solid rgba(47,214,214,0.2); padding-top:8px; }
.ps-tag { font-size:9.5px; letter-spacing:0.14em; color:#02100e; background:#2fd6d6;
  padding:2px 5px; font-weight:bold; flex:none; }
.ps-fact { font-size:12px; line-height:1.4; color:rgba(234,255,249,0.85); }

.ps-answer { position:absolute; left:18px; bottom:calc(132px + 132px);
  width:min(430px, 44vw); background:rgba(4,20,15,0.94); border:1.5px solid #ffd23a;
  padding:11px 13px; animation:psin .25s ease both; }
.ps-answer.vibes { border-color:#7a8b86; }
.ps-answer-line { font-size:13px; line-height:1.45; font-style:italic; }
.ps-answer-note { font-size:10px; letter-spacing:0.1em; margin-top:8px; color:#ffd23a; font-weight:bold; }
.ps-answer.vibes .ps-answer-note { color:#bfeede; }
@keyframes psin { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

/* The card rack. Anchored RIGHT so it can never reach the claim panel, which
   owns the left. Its bottom clears the dock row beneath it. */
.ps-hand-wrap { position:absolute; right:18px; bottom:122px; }
.ps-ask-label { font-size:9.5px; letter-spacing:0.13em; color:rgba(255,210,58,0.75);
  font-weight:bold; margin-bottom:7px; text-align:right; }
.ps-hand { display:flex; gap:10px; justify-content:flex-end; }
.ps-card { width:172px; text-align:left; cursor:pointer;
  display:flex; flex-direction:column; gap:5px;
  background:linear-gradient(160deg, rgba(20,8,32,0.96), rgba(6,20,18,0.96));
  border:1px solid rgba(255,210,58,0.55); color:#eafff9; padding:10px 11px;
  clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));
  transition:transform .12s ease, box-shadow .12s ease; }
.ps-card:hover:not(:disabled) { transform:translateY(-4px);
  box-shadow:0 0 20px rgba(255,210,58,0.35); border-color:#ffd23a; }
.ps-card:disabled { cursor:default; opacity:0.35; }
.ps-card.spent { border-color:rgba(122,139,134,0.5); }
.ps-card-name { font-size:10px; letter-spacing:0.14em; font-weight:bold; color:#ffd23a; }
.ps-card-q { font-size:12.5px; line-height:1.35; font-style:italic; }
.ps-card-hint { font-size:9.5px; letter-spacing:0.06em; color:rgba(234,255,249,0.45); }

.ps-answer-asked { font-size:9.5px; letter-spacing:0.12em; color:rgba(234,255,249,0.5);
  margin-bottom:6px; }
.ps-answer.wasted { border-color:#7a8b86; }
.ps-answer.wasted .ps-answer-note { color:#ff9b6f; }

.ps-dock { position:absolute; left:18px; right:18px; bottom:52px;
  display:flex; align-items:center; gap:18px; }
.ps-press { background:#ff2d6f; border:none; color:#fff; padding:13px 24px; cursor:pointer;
  display:flex; flex-direction:column; align-items:flex-start; gap:2px; flex:none;
  box-shadow:0 0 26px rgba(255,45,111,0.5);
  clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px)); }
.ps-press:disabled { background:rgba(120,120,120,0.35); box-shadow:none; cursor:default;
  color:rgba(255,255,255,0.55); }
.ps-press-main { font-size:16px; font-weight:bold; letter-spacing:0.16em; }
.ps-press-sub { font-size:10px; letter-spacing:0.05em; opacity:0.85; }
.ps-meter { display:flex; align-items:center; gap:6px; }
.ps-pip { width:11px; height:11px; border:1.5px solid rgba(255,45,111,0.6); border-radius:50%; }
.ps-pip.live { background:#ff2d6f; box-shadow:0 0 9px rgba(255,45,111,0.8); }
.ps-meter-label { font-size:9.5px; letter-spacing:0.12em; color:rgba(234,255,249,0.55); margin-left:4px; }
.ps-nav { margin-left:auto; display:flex; gap:10px; }
.ps-next, .ps-call { background:rgba(2,16,14,0.85); border:1px solid rgba(47,214,214,0.5);
  color:#2fd6d6; font-size:11.5px; letter-spacing:0.08em; padding:11px 16px; cursor:pointer; }
.ps-call { border-color:rgba(255,210,58,0.55); color:#ffd23a; }

.ps-progress { position:absolute; left:18px; bottom:34px; display:flex; gap:6px; }
.ps-dot { width:22px; height:3px; background:rgba(234,255,249,0.18); }
.ps-dot.past { background:rgba(234,255,249,0.4); }
.ps-dot.now { background:#2fd6d6; }
.ps-dot.hit { background:#ffd23a; }
.ps-dot.black { background:#7a8b86; }

.ps-open { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(900px, calc(100% - 40px)); max-height:90vh; overflow-y:auto;
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
.ps-open-copy { flex:1; min-width:0; align-self:flex-start; }
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
.ps-tool-hand { flex:1; min-width:0; padding-left:16px;
  border-left:1px solid rgba(47,214,214,0.2); }
.ps-draw-label { font-size:9px; letter-spacing:0.13em; color:rgba(255,210,58,0.8);
  font-weight:bold; margin-bottom:7px; }
.ps-draw-row { display:flex; gap:9px; flex-wrap:wrap; }
.ps-draw-card { flex:none; background:none; border:none; padding:0; cursor:zoom-in;
  display:flex; flex-direction:column; align-items:center; gap:4px;
  transition:transform .12s ease; }
.ps-draw-card:hover { transform:translateY(-3px); }

/* ---- THE DEAL ----
   .ps-slot is static and always occupies the card's exact box, so the table
   has its final shape while it is still empty and nothing reflows on landing.
   .ps-fly belongs to GSAP alone. Before the deal it's transparent, which is
   why the ghost outline underneath is what you actually see. */
.ps-slot { position:relative; display:block; flex:none; }
.ps-slot-ghost { position:absolute; inset:0; border:1px dashed rgba(47,214,214,0.32);
  border-radius:9px; background:
    repeating-linear-gradient(135deg, rgba(47,214,214,0.05) 0 6px, transparent 6px 12px); }
.ps-fly { position:absolute; inset:0; display:block; opacity:0;
  transform-style:preserve-3d; }
.ps-face { position:absolute; inset:0; display:block; backface-visibility:hidden;
  -webkit-backface-visibility:hidden; }
/* Face-UP is the resting state (rotationY 0) so that when the deal ends GSAP
   can clear the transform outright and leave no composited layer sitting over
   the live scene for the rest of the session. */
.ps-face-back { transform:rotateY(180deg);
  background:url("/TCG/cardBack.webp") center / cover no-repeat,
    linear-gradient(160deg, #0a221f, #050f0d 75%);
  border:1px solid rgba(255,210,58,0.45); border-radius:9px;
  box-shadow:0 0 20px rgba(255,210,58,0.18); }
/* Landed cards are inspectable. In-flight ones aren't, and neither is an empty
   table — clicking a slot that holds nothing yet must do nothing. */
.ps-open:not(.is-dealt) .ps-hero-card,
.ps-open:not(.is-dealt) .ps-draw-card { pointer-events:none; }
.ps-open.is-dealt .ps-fly { opacity:1; }
.ps-open.is-dealt .ps-slot-ghost { opacity:0; }
.ps-skip-deal { position:absolute; inset:0; z-index:5; background:none; border:none;
  padding:0; cursor:pointer; }

/* the deck it all comes off */
.ps-cta-row { display:flex; align-items:center; gap:14px; margin-top:6px; }
.ps-cta-row .ps-lock { flex:1; width:auto; margin-top:0; }
.ps-deck { position:relative; display:block; flex:none; width:54px; height:75px;
  transition:opacity .45s ease, transform .45s ease; }
.ps-deck-card { position:absolute; inset:0; border-radius:5px;
  background:url("/TCG/cardBack.webp") center / cover no-repeat,
    linear-gradient(160deg, #0a221f, #050f0d 75%);
  border:1px solid rgba(255,210,58,0.4); box-shadow:0 2px 10px rgba(0,0,0,0.5); }
.ps-deck-card:nth-child(1) { transform:translate(-3px,-3px) rotate(-4deg); }
.ps-deck-card:nth-child(2) { transform:translate(-1px,-1px) rotate(2deg); }
.ps-deck.is-spent { opacity:0.2; transform:scale(0.94); }

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
  .ps-claim, .ps-answer { width:calc(100% - 36px); }
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
  .ps-answer { bottom:calc(132px + 150px); }
  .ps-dock { flex-wrap:wrap; gap:10px; }
  .ps-nav { margin-left:0; width:100%; }
}
`;
