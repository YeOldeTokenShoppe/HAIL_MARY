"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MRDN from "@/game/terminal-traders/press/deals/mrdn";
import { ANY, BACKING } from "@/game/terminal-traders/press/questions";
import { HAND } from "@/game/terminal-traders/press/hand";
import {
  PHASE, PRESSES, STAKE,
  createRun, press as doPress, advance as doAdvance, callIt as doCallIt,
  allocate as doAllocate, toAutopsy, currentClaim, callReadout, readScore,
} from "@/game/terminal-traders/press/pressRun";
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

const SPEAKER_AGENT = "Demon";    // John Barron's agentId in CyborgTempleScene
const SPEAKER_STATION = "demon";  // -> __screen2Canvas (SCREEN_TARGETS in evidenceScreen.js)
const READ_MS = 4200;           // how long a claim holds the floor before it can land

export default function PressSession({
  deal = MRDN,
  onFocusAgent,
  onSpeechActive,
  onRevealChange,
  onExit,
}) {
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
  const screenRef = useRef(null);

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

  const readout = useMemo(() => callReadout(slider), [slider]);
  const read = useMemo(() => readScore(run, deal), [run, deal]);
  const pressed = claim ? run.outcomes[claim.id] : null;

  /* ------------------------------------------------------------------ */
  return (
    <div className="ps-root">
      <style>{CSS}</style>

      {/* ---------- top bar: always visible, never blocks the room ---------- */}
      <div className="ps-bar">
        <button className="ps-exit" onClick={onExit}>◀ LEAVE THE DESK</button>
        <div className="ps-deal">
          {deal.ticker} · {deal.name} <span className="ps-dim">· {deal.chain}</span>
        </div>
        <div className="ps-book">
          BOOK <b>{Math.round(run.book)}</b>
        </div>
      </div>

      {/* ---------- the opening: the room, then the deal ---------- */}
      {!started && (
        <div className="ps-open">
          <div className="ps-open-eyebrow">ONE DEAL ON THE TABLE</div>
          <div className="ps-open-name">{deal.name}</div>
          <div className="ps-open-sub">
            {deal.ticker} · {deal.chain} · {deal.surface.age} old · {deal.surface.mcap}
          </div>
          <div className="ps-open-body">
            John Barron brought this one in. It's his deal — if you fund it, he gets paid.
            He's going to talk for about two minutes.
          </div>
          <div className="ps-open-rule">
            You can interrupt him <b>three times</b> and make him put a number on it.
            Whatever he can actually back lands on his screen. Whatever he can't, doesn't.
          </div>
          <button className="ps-lock" onClick={() => setStarted(true)}>LET HIM PITCH ▸</button>
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

          {/* The hand. Each card is one sentence you may say instead of the
              generic press — same cost, sharper aim, and it can miss. */}
          <div className="ps-hand">
            {HAND.map((c) => {
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
                  <span className="ps-card-hint">{spent ? "PLAYED" : c.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="ps-dock">
            <button
              className="ps-press"
              onClick={() => press(ANY, null)}
              disabled={run.pressesLeft <= 0 || !!pressed}
            >
              <span className="ps-press-main">PRESS</span>
              <span className="ps-press-sub">
                {pressed ? "already pressed him on this"
                  : run.pressesLeft <= 0 ? "out of presses"
                    : "“put a number on it”"}
              </span>
            </button>

            <div className="ps-meter" aria-label={`${run.pressesLeft} presses left`}>
              {Array.from({ length: PRESSES }).map((_, i) => (
                <span key={i} className={`ps-pip ${i < run.pressesLeft ? "live" : ""}`} />
              ))}
              <span className="ps-meter-label">PRESSES LEFT</span>
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

      {/* ---------- resolution: the room plays the curtain call under this ---------- */}
      {run.phase === PHASE.RESOLUTION && (
        <div className="ps-panel wide">
          <div className="ps-panel-h">{run.call.pnl >= 0 ? "YOU READ IT RIGHT" : "YOU GOT IT WRONG"}</div>
          <div className={`ps-pnl ${run.call.pnl >= 0 ? "up" : "down"}`}>
            {run.call.pnl >= 0 ? "+" : ""}{Math.round(run.call.pnl)}
          </div>
          <div className="ps-truth">{deal.resolution}</div>
          <button className="ps-lock" onClick={finish}>WHAT HE ACTUALLY SAID ▸</button>
        </div>
      )}

      {/* ---------- autopsy ---------- */}
      {run.phase === PHASE.AUTOPSY && (
        <div className="ps-panel wide scroll">
          <div className="ps-panel-h">THE AUTOPSY</div>
          <div className="ps-scores">
            <div><span className="ps-dim">READ</span><b>{read.hit}/{read.spent || 0}</b></div>
            <div><span className="ps-dim">BOOK</span><b>{Math.round(run.book)}</b></div>
          </div>
          <div className="ps-readnote">{read.note}</div>
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
.ps-claim { position:absolute; left:18px; bottom:150px; width:min(430px, 44vw);
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

.ps-answer { position:absolute; left:18px; bottom:calc(150px + 132px);
  width:min(430px, 44vw); background:rgba(4,20,15,0.94); border:1.5px solid #ffd23a;
  padding:11px 13px; animation:psin .25s ease both; }
.ps-answer.vibes { border-color:#7a8b86; }
.ps-answer-line { font-size:13px; line-height:1.45; font-style:italic; }
.ps-answer-note { font-size:10px; letter-spacing:0.1em; margin-top:8px; color:#ffd23a; font-weight:bold; }
.ps-answer.vibes .ps-answer-note { color:#bfeede; }
@keyframes psin { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

/* the hand — three questions, sat just above the press dock */
.ps-hand { position:absolute; right:18px; bottom:124px; display:flex; gap:10px; }
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
.ps-press { background:#ff2d6f; border:none; color:#fff; padding:14px 26px; cursor:pointer;
  display:flex; flex-direction:column; align-items:flex-start; gap:2px;
  box-shadow:0 0 26px rgba(255,45,111,0.5); clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px)); }
.ps-press:disabled { background:rgba(120,120,120,0.35); box-shadow:none; cursor:default; color:rgba(255,255,255,0.5); }
.ps-press-main { font-size:17px; font-weight:bold; letter-spacing:0.16em; }
.ps-press-sub { font-size:10px; letter-spacing:0.06em; opacity:0.85; }
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

.ps-open { position:absolute; left:50%; bottom:8%; transform:translateX(-50%);
  width:min(560px, calc(100% - 40px)); background:rgba(2,16,14,0.9);
  border:1px solid rgba(47,214,214,0.4); border-left:3px solid #ff5f9e; padding:22px 24px; }
.ps-open-eyebrow { font-size:10px; letter-spacing:0.18em; color:#ff5f9e; font-weight:bold; }
.ps-open-name { font-size:26px; font-weight:bold; letter-spacing:0.06em; margin-top:8px; }
.ps-open-sub { font-size:11px; letter-spacing:0.08em; color:rgba(234,255,249,0.5); margin-top:5px; }
.ps-open-body { font-size:13.5px; line-height:1.55; margin-top:16px; }
.ps-open-rule { font-size:13.5px; line-height:1.55; margin-top:12px; color:#ffd23a; }
.ps-open-rule b { color:#fff; }

.ps-panel { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:min(520px, calc(100% - 40px)); background:rgba(2,16,14,0.95);
  border:1.5px solid rgba(47,214,214,0.55); padding:22px; text-align:center; }
.ps-panel.wide { width:min(640px, calc(100% - 40px)); text-align:left; }
.ps-panel.scroll { max-height:76vh; overflow-y:auto; }
.ps-panel-h { font-size:12px; letter-spacing:0.16em; color:#2fd6d6; font-weight:bold; margin-bottom:16px; }
.ps-slider { width:100%; accent-color:#ff2d6f; }
.ps-slider-ends { display:flex; justify-content:space-between; font-size:10px;
  letter-spacing:0.12em; color:rgba(234,255,249,0.5); margin-top:4px; }
.ps-saying { font-size:16px; margin-top:18px; }
.ps-risk { font-size:12.5px; color:#ffd23a; margin-top:8px; }
.ps-lock { margin-top:20px; width:100%; background:none; border:1px solid #ffd23a;
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
  .ps-answer { bottom:calc(150px + 150px); }
  .ps-dock { flex-wrap:wrap; gap:10px; }
  .ps-nav { margin-left:0; width:100%; }
}
`;
