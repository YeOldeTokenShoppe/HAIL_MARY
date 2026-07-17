// The three-dial position ticket (v4): P(SCAM) is calibration, STAKE is
// sizing, HORIZON is the opt-in timing side pot. No unscored dials — each
// gets its own named line in the Ledger. Sizing math stays hidden until the
// debrief ("felt, not computed"); the side pot's TERMS are public at commit.
import React from "react";
import { HORIZON, HORIZON_HIT, HORIZON_MISS, MAX_STAKE, bucket } from "@/game/terminal-traders/docketRun";
import { STAKE, VCOLOR, VLABEL } from "./constants";
import Shell from "./Shell";
import SeatStrip from "./SeatStrip";
import Tip from "./Tip";

export default function PositionTicket({
  ticker, caseIndex, docketLength,
  books, busted, ledger, patron,
  ticketP, onTicketP, ticketStake, onTicketStake, ticketHorizon, onTicketHorizon,
  payoutMult,
  tipSeen, onDismissTip,
  onLock, onBack,
}) {
  const p = ticketP / 100;
  const v = bucket(p);
  const boldNow = patron === "demon" && Math.abs(p - 0.5) >= 0.3;
  const mult = payoutMult * (boldNow ? 1.25 : 1);
  const rightBrier = (p - (p >= 0.5 ? 1 : 0)) ** 2;
  const wrongBrier = (p - (p >= 0.5 ? 0 : 1)) ** 2;
  const ifRight = Math.round(ticketStake * (1 - 4 * rightBrier) * mult);
  const ifWrong = Math.round(ticketStake * (1 - 4 * wrongBrier) * mult);
  const h = HORIZON[ticketHorizon];
  return (
    <Shell>
      <div className="ct-talk">
        <SeatStrip books={books} busted={busted} ledger={ledger} patron={patron} />
        <div className="ct-eyebrow">▸ POSITION TICKET — CASE {caseIndex + 1}/{docketLength} · {ticker}</div>
        <div className="ct-talk-note">Three dials, three skills. Every dial gets its own line in the Ledger.</div>
        {!tipSeen && (
          <Tip title="THE TICKET — FIRST TIME" onDismiss={onDismissTip}>
            Bold and right pays best; bold and wrong costs about triple. Dead center risks nothing and wins nothing.
            Unsure of your read? Say so with the stake — sizing honestly is scored too. The timing call is a side
            bet: skip it unless the evidence told you when.
          </Tip>
        )}

        <div className="ct-dial" style={{ "--dc": VCOLOR[v] }}>
          <div className="ct-dial-head">
            <span className="ct-dial-name">01 · P(SCAM) — YOUR READ</span>
            <span className="ct-dial-val">{ticketP}% · {VLABEL[v]}</span>
          </div>
          <input type="range" min={0} max={100} step={1} value={ticketP}
            onChange={(e) => onTicketP(+e.target.value)} aria-label="Probability this token is a scam" />
          <div className="ct-dial-sub">Dead center is Abstain — it pays nothing and costs nothing.</div>
        </div>

        <div className="ct-dial" style={{ "--dc": "#2fd6d6" }}>
          <div className="ct-dial-head">
            <span className="ct-dial-name">02 · STAKE — YOUR SIZE</span>
            <span className="ct-dial-val">{ticketStake} / {MAX_STAKE}</span>
          </div>
          <input type="range" min={0} max={MAX_STAKE} step={1} value={ticketStake}
            onChange={(e) => onTicketStake(+e.target.value)} aria-label="Stake for this case" />
          <div className="ct-dial-sub">
            The council benchmarks a flat {STAKE}. This ticket: right{" "}
            <span style={{ color: "#4dffaa" }}>{ifRight >= 0 ? "+" : ""}{ifRight}</span> · wrong{" "}
            <span style={{ color: "#ff5454" }}>{ifWrong}</span>
            {boldNow ? " · ⟡ DEVIL'S LEVERAGE ×1.25 armed" : ""}
            {payoutMult > 1 ? " · BULL RUN ×1.25" : ""}
          </div>
        </div>

        <div className="ct-dial" style={{ "--dc": "#ffd23a" }}>
          <div className="ct-dial-head">
            <span className="ct-dial-name">03 · HORIZON — YOUR TIMING</span>
            <span className="ct-dial-val">{h.label}</span>
          </div>
          <input type="range" min={0} max={HORIZON.length - 1} step={1} value={ticketHorizon}
            onChange={(e) => onTicketHorizon(+e.target.value)} aria-label="When does it unravel" />
          <div className="ct-dial-sub">
            {h.sub}. Side pot: a rug landing in your window pays +{HORIZON_HIT}; anything else {HORIZON_MISS} — including a token that holds.
          </div>
        </div>

        <button className="ct-cta" onClick={() => onLock({ p, v })}>LOCK THE TICKET ▸</button>
        <button className="ct-ghost" onClick={onBack}>◀ BACK TO PUNDIT CALLS</button>
      </div>
    </Shell>
  );
}
