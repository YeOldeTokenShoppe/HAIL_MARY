"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instanceDeal, dailySeed } from "@/game/terminal-traders/press/instanceDeal";
import { ANY, BACKING } from "@/game/terminal-traders/press/questions";
import { dealHand } from "@/game/terminal-traders/press/hand";
import {
  PHASE, PRESSES,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, readScore,
} from "@/game/terminal-traders/press/pressRun";
import { toDealCard, toExemplarCard, toQuestionCard, toCharacterCard } from "@/game/terminal-traders/press/dealCard";
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

  const hand = useMemo(() => {
    const live = new Set(deal.claims.map((c) => c.shape));
    return dealHand(Number(String(deal.id).split(":")[1]) || 1, live);
  }, [deal]);

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
  const screenRef = useRef(null);
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
  const speakerNamed = dealt || landed >= 2;  // slot 1 — who's pitching
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
  const speakerCard = useMemo(() => toCharacterCard("john-barron"), []);
  const handCards = useMemo(() => hand.map((q) => ({ q, data: toQuestionCard(q) })), [hand]);
  const readout = useMemo(() => callReadout(slider), [slider]);
  const read = useMemo(() => readScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;

  /* ---- the evidence screen, as an actual on-screen terminal ---- */
  useEffect(() => {
    const el = document.getElementById("pf-screen-canvas");
    if (!el) return;
    const s = createFlatEvidenceScreen(el, { header: "BARRON" });
    screenRef.current = s;
    return () => { s.dispose(); screenRef.current = null; };
  }, [started]);

  /* ---- he says it out loud ---- */
  const say = useCallback(async (text) => {
    if (!text) return;
    setSpeaking(true);
    try { await speakAdviserLine(VOICE, text); }
    catch { /* voice is enrichment, never a gate on play */ }
    finally { setSpeaking(false); }
  }, []);

  useEffect(() => {
    if (!onFloor || !claim) return;
    say(claim.spin);
    return () => { try { stopAdviserAudio(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFloor, run.claimIndex]);

  useEffect(() => () => { try { stopAdviserAudio(); } catch {} }, []);

  /* ---- actions ---- */
  const press = useCallback((question = ANY, card = null) => {
    if (!onFloor || run.pressesLeft <= 0 || !claim || run.outcomes[claim.id]) return;
    if (card && run.cardsSpent.includes(card.id)) return;
    const next = doPress(run, deal, question, card?.id ?? null);
    if (next === run) return;
    const outcome = next.outcomes[claim.id];
    setRun(next);
    setFlash({
      id: claim.id, line: outcome.line, backing: outcome.backing,
      wasted: outcome.wasted, named: outcome.named,
      asked: card ? card.question : "Put a number on it.",
    });
    if (outcome.receipt) screenRef.current?.stamp(outcome.receipt);
    else screenRef.current?.stayBlack();
    setHasRecord(!!outcome.receipt);
    setPane("screen");   // cut to the board — receipt or conspicuous nothing
    say(outcome.line);
  }, [run, deal, claim, onFloor, say]);

  const advance = useCallback(() => {
    setFlash(null);
    setPane("feed");     // new claim, back to his face
    setHasRecord(false);
    setRun((r) => doAdvance(r, deal));
  }, [deal]);
  const callIt = useCallback(() => { setFlash(null); setRun((r) => doCallIt(r, deal)); }, [deal]);
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
          <div className="pf-label">{dealt ? "YOU DREW" : "YOUR HAND"}</div>
          <div className="pf-strip" ref={stripRef}>
            {speakerCard && (
              <button className="pf-thumb" onClick={() => dealt && setInspect(speakerCard)}>
                <DealtSlot index={1} scale={0.15} register={registerSlot}>
                  <TradingCard data={speakerCard} scale={0.15} interactive={false} templateStyle="terminal" />
                </DealtSlot>
                <span className="pf-cap">PITCHING</span>
              </button>
            )}
            {handCards.map(({ q, data }, i) => (
              <button key={q.id} className="pf-thumb" onClick={() => dealt && setInspect(data)}>
                <DealtSlot index={2 + i} scale={0.15} register={registerSlot}>
                  <TradingCard data={data} scale={0.15} interactive={false} templateStyle="terminal" />
                </DealtSlot>
                <span className="pf-cap">{q.name}</span>
              </button>
            ))}
          </div>
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
            <button className={pane === "screen" ? "on" : ""} onClick={() => setPane("screen")}>
              ▤ HIS SCREEN
              <em className={hasRecord ? "rec" : ""}>{hasRecord ? " · ON RECORD" : " · no record"}</em>
            </button>
          </div>
          <div className="pf-stage">
            <div className={`pf-pane ${pane === "feed" ? "show" : ""}`}>
              <PressFigure speaking={speaking} />
            </div>
            <div className={`pf-pane wide ${pane === "screen" ? "show" : ""}`}>
              <div className="pf-screen"><canvas id="pf-screen-canvas" width={512} height={320} /></div>
            </div>
          </div>

          <div className="pf-claim">
            <div className="pf-claim-who">JOHN BARRON <span className="pf-dim">— his deal</span></div>
            <div className="pf-spin">“{claim.spin}”</div>
            <div className="pf-fact"><span className="pf-tag">FACT</span> {claim.fact}</div>
          </div>

          {flash && flash.id === claim.id && (
            <div className={`pf-answer ${flash.wasted ? "wasted" : flash.backing === BACKING.VIBES ? "vibes" : ""}`}>
              <div className="pf-asked">YOU ASKED — “{flash.asked}”</div>
              <div className="pf-said">“{flash.line}”</div>
              <div className="pf-note">
                {flash.wasted ? "✕ TRUE, AND NOT WHAT YOU NEEDED."
                  : flash.named ? "▚ STILL BLACK — but you know what kind of nothing this is."
                    : flash.backing === BACKING.VIBES ? "▚ HIS SCREEN STAYS BLACK."
                      : flash.backing === BACKING.SOFT ? "◍ PARTIAL — some of it landed."
                        : "◼ ON RECORD."}
              </div>
            </div>
          )}

          <div className="pf-dock">
            <div className="pf-pips">
              {Array.from({ length: PRESSES }).map((_, i) => (
                <span key={i} className={i < run.pressesLeft ? "on" : ""} />
              ))}
              <em>INTERRUPTIONS LEFT</em>
            </div>
            <button className="pf-btn primary" disabled={run.pressesLeft <= 0 || !!pressed}
                    onClick={() => press(ANY, null)}>
              PRESS HIM<small>“put a number on it”</small>
            </button>
            <div className="pf-strip tight">
              {handCards.map(({ q, data }) => {
                const spent = run.cardsSpent.includes(q.id);
                return (
                  <button key={q.id} className={`pf-thumb ${spent ? "spent" : ""}`}
                          disabled={spent || run.pressesLeft <= 0 || !!pressed}
                          onClick={() => press(q.shape, q)}>
                    <TradingCard data={data} scale={0.13} interactive={false} templateStyle="terminal" />
                    <span>{spent ? "USED" : q.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="pf-nav">
              <button className="pf-btn" onClick={advance}>LET HIM GO ON ▸</button>
              <button className="pf-btn amber" onClick={callIt}>CALL IT</button>
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
.pf-scroll.center { display:flex; flex-direction:column; align-items:center;
  justify-content:center; text-align:center; }
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
.pf-thumb { flex:0 0 auto; background:none; border:none; padding:0;
  display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; }
.pf-thumb span { font:bold 8px/1.2 'Courier New',monospace; letter-spacing:0.08em;
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

/* the floor — portrait, thumb-first */
.pf-floor { flex:1; display:flex; flex-direction:column; min-height:0; }
.pf-stage { flex:none; height:32vh; min-height:215px; max-height:330px; padding:10px 0;
  display:flex; justify-content:center; align-items:center; overflow:hidden;
  background:radial-gradient(ellipse at 50% 35%, rgba(255,45,111,0.14), transparent 68%); }
.pf-stage > * { height:100%; }

.pf-claim { flex:none; padding:10px 14px; border-left:2px solid #ff5f9e; margin:0 12px; }
.pf-claim-who { font-size:9.5px; letter-spacing:0.13em; color:#ff5f9e; font-weight:bold; }
.pf-spin { font-size:14px; line-height:1.42; margin:6px 0 8px; }
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

.pf-pane { display:none; width:100%; height:100%; justify-content:center; align-items:center; }
.pf-pane.show { display:flex; }
.pf-pane.wide { padding:0 12px; }
.pf-screen { width:100%; border:1px solid rgba(47,214,214,0.3); }
.pf-screen canvas { display:block; width:100%; height:auto; }

.pf-answer { flex:none; margin:10px 12px 0; padding:10px 12px;
  background:rgba(4,20,15,0.95); border:1.5px solid #ffd23a; }
.pf-answer.vibes { border-color:#7a8b86; }
.pf-answer.wasted { border-color:#7a8b86; }
.pf-asked { font-size:8.5px; letter-spacing:0.11em; color:rgba(234,255,249,0.5); }
.pf-said { font-size:12.5px; line-height:1.45; font-style:italic; margin-top:5px; }
.pf-note { font-size:9.5px; letter-spacing:0.09em; font-weight:bold; color:#ffd23a; margin-top:7px; }
.pf-answer.vibes .pf-note { color:#bfeede; }
.pf-answer.wasted .pf-note { color:#ff9b6f; }

.pf-dock { margin-top:auto; flex:none; padding:10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top:1px solid rgba(47,214,214,0.25); background:rgba(2,16,14,0.96); }
.pf-pips { display:flex; align-items:center; gap:5px; margin-bottom:8px; }
.pf-pips span { width:10px; height:10px; border-radius:50%; border:1.5px solid rgba(255,45,111,0.6); }
.pf-pips span.on { background:#ff2d6f; box-shadow:0 0 8px rgba(255,45,111,0.8); }
.pf-pips em { font-style:normal; font-size:8.5px; letter-spacing:0.11em;
  color:rgba(234,255,249,0.5); margin-left:4px; }
.pf-nav { display:flex; gap:8px; margin-top:8px; }
.pf-nav .pf-btn { flex:1; }

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
