// The lobby: the temple-fund framing, the three-step rules, and the patron
// pick that starts a docket (§4.1). Dev-only controls (seed stepper, tips
// reset) render only when `dev` is set — production seeds come from the
// Daily Docket date.
import React from "react";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";
import { BASE_ACTIONS, MAX_STAKE, PATRONS } from "@/game/terminal-traders/docketRun";
import { STAKE, START_PF } from "./constants";
import Shell from "./Shell";

export default function Lobby({ docketLength, onStart, onExit, exitLabel = "◀ TERMINAL", dev, seed, onSeedStep, onResetTips }) {
  return (
    <Shell>
      <div className="ct-lobby">
        <div className="ct-lobby-top">
          <div className="ct-eyebrow">▸ THE CASE TABLE{dev ? " — DEV MOCK v4" : ""}</div>
          <div className="ct-devrow">
            {dev && (
              <>
                <button className="ct-dev" title="Deterministic docket seed — dev only. Same seed replays the same table. In production this becomes the Daily Docket date."
                  onClick={onSeedStep}>DEV · SEED {seed} ↻</button>
                <button className="ct-dev" title="Show the first-run tips again" onClick={onResetTips}>TIPS ↺</button>
              </>
            )}
            {onExit && <button className="ct-dev" onClick={onExit}>{exitLabel}</button>}
          </div>
        </div>
        <div className="ct-title">The Terminal has allocated you a book.<br />Don't lose the house's money.</div>
        <div className="ct-sub">
          You are the fifth seat at Our Lady of Perpetual Profit's trading desk — a book
          of {START_PF}, a docket of {docketLength} cases, four partners running their own books beside you.
        </div>
        <div className="ct-steps">
          <div className="ct-step"><span className="ct-step-n">01</span>
            <div><b>WORK THE CASE</b> — {BASE_ACTIONS} actions per case. Ask a consultant a question, or play a card from your kit. Same cost.</div></div>
          <div className="ct-step"><span className="ct-step-n">02</span>
            <div><b>READ THE ROOM</b> — the partners call vague leans before you commit. Their exact numbers stay sealed until the Ledger.</div></div>
          <div className="ct-step"><span className="ct-step-n">03</span>
            <div><b>LOCK THE TICKET</b> — three dials: your read, your stake (up to {MAX_STAKE}; the council benchmarks a flat {STAKE}), your timing. A max-conviction miss at full stake costs {MAX_STAKE * 3}. That's more than your book. Barron would do it anyway.</div></div>
        </div>
        <div className="ct-eyebrow" style={{ marginTop: 6 }}>▸ CHOOSE YOUR PATRON — their perk rides the whole docket</div>
        <div className="ct-picks">
          {CHARACTER_ORDER.map((k) => {
            const meta = CHARACTER_META[k];
            return (
              <button key={k} className="ct-pick" style={{ "--cc": meta.color }} onClick={() => onStart(k)}>
                <img src={meta.portrait} alt={meta.name} />
                <div className="ct-pick-name">{meta.name}</div>
                <div className="ct-pick-perk">{PATRONS[k].perk}</div>
                <div className="ct-pick-role">{PATRONS[k].desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
