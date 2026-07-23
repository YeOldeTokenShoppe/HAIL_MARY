// The lobby: the temple-fund framing, the three-step rules, and the patron
// pick that starts a docket (§4.1). Dev-only controls (seed stepper, tips
// reset) render only when `dev` is set — production seeds come from the
// Daily Docket date.
import React, { useEffect, useState } from "react";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";
import { BASE_ACTIONS, MAX_STAKE, PATRONS } from "@/game/terminal-traders/docketRun";
import { getCardById } from "@/game/terminal-traders/cards";
import { toTemplateCard } from "@/game/terminal-traders/templateCard";
import TradingCard from "@/components/TradingCard";
import { STAKE, START_PF } from "./constants";
import Shell from "./Shell";

// The patron pick shows the real thing: each station's canonical Genesis
// trader card (mythic art, gold frame, hero foil), joined via traderId.
const TRADER_CARD = Object.fromEntries(
  CHARACTER_ORDER.map((k) => [k, toTemplateCard(getCardById(CHARACTER_META[k].traderId))])
);

export default function Lobby({ docketLength, onStart, onExit, exitLabel = "◀ TERMINAL", dev, seed, onSeedStep, onResetTips }) {
  // Two trader cards per row inside the 560px lobby column; shrink on
  // narrow phones so the pair still fits.
  const [cardScale, setCardScale] = useState(0.33);
  useEffect(() => {
    const fit = () => setCardScale(Math.min(0.33, (window.innerWidth - 64) / 2 / 744));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <Shell>
      <div className="ct-lobby">
        <div className="ct-lobby-top">
          <div className="ct-eyebrow">▸ THE DESK{dev ? " — DEV MOCK v4" : ""}</div>
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
          of {START_PF}, a deal flow of {docketLength} prospects, four partners running their own books beside you.
        </div>
        <div className="ct-steps">
          <div className="ct-step"><span className="ct-step-n">01</span>
            <div><b>DO THE RESEARCH</b> — {BASE_ACTIONS} free actions per deal (a question or a card, same cost). Keep digging past that and every extra look bills your book. Or skip it all and trade the chart.</div></div>
          <div className="ct-step"><span className="ct-step-n">02</span>
            <div><b>READ THE ROOM</b> — the partners call vague leans before you commit. Their exact numbers stay sealed until the Ledger.</div></div>
          <div className="ct-step"><span className="ct-step-n">03</span>
            <div><b>LOCK THE TICKET</b> — three dials: your read, your stake (up to {MAX_STAKE}; the council benchmarks a flat {STAKE}), your timing. A max-conviction miss at full stake costs {MAX_STAKE * 3}. That's more than your book. Barron would do it anyway.</div></div>
        </div>
        <div className="ct-eyebrow" style={{ marginTop: 6 }}>▸ CHOOSE YOUR BACKER — one partner stakes your book; their edge rides the whole deal flow</div>
        <div className="ct-cardpicks">
          {CHARACTER_ORDER.map((k) => {
            const meta = CHARACTER_META[k];
            return (
              <button key={k} className="ct-cardpick" style={{ "--cc": meta.color }} onClick={() => onStart(k)}>
                <TradingCard data={TRADER_CARD[k]} scale={cardScale} interactive={false} templateStyle="terminal" />
                <span className="ct-pick-perk">{PATRONS[k].perk}</span>
                <span className="ct-pick-role">{PATRONS[k].desc}</span>
              </button>
            );
          })}
        </div>
        <style>{`
          .ct-cardpicks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
          .ct-cardpick { display: flex; flex-direction: column; align-items: center; gap: 5px;
            background: none; border: 1.5px solid transparent; border-radius: 14px; padding: 6px 4px 9px;
            font: inherit; cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease; }
          .ct-cardpick:hover { transform: translateY(-4px); border-color: var(--cc);
            box-shadow: 0 0 20px color-mix(in srgb, var(--cc) 35%, transparent); }
          .ct-cardpick .ct-pick-perk { margin-top: 4px; }
          .ct-cardpick .ct-pick-role { max-width: 230px; }
        `}</style>
      </div>
    </Shell>
  );
}
