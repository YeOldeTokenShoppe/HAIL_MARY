// Pundit calls: the partners state leans only — exact numbers stay sealed
// until the Ledger (§4.2.3, anti copy-trading). Insider Ping's sanctioned
// crack (wiretap one partner) resolves here.
import React from "react";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";
import { BOT_SIG, LEAN_LINES, bucket } from "@/game/terminal-traders/docketRun";
import { VLABEL } from "./constants";
import Shell from "./Shell";
import SeatStrip from "./SeatStrip";
import Tip from "./Tip";

export default function PunditCalls({
  ticker, caseIndex, docketLength,
  books, busted, ledger, patron,
  punditFinal, mods,
  peekArmed, peekChoice, onPeek,
  tipSeen, onDismissTip,
  onCommit, onBack,
}) {
  return (
    <Shell>
      <div className="ct-talk">
        <SeatStrip books={books} busted={busted} ledger={ledger} patron={patron} />
        <div className="ct-eyebrow">▸ PUNDIT CALLS — CASE {caseIndex + 1}/{docketLength} · {ticker}</div>
        <div className="ct-talk-note">The partners call their leans. Exact numbers stay sealed until the Ledger — read the room, don't copy it.</div>
        {!tipSeen && (
          <Tip title="PUNDIT CALLS — FIRST TIME" onDismiss={onDismissTip}>
            Leans are color, not answers. Each partner only read part of the case, and each has a bias —
            their exact numbers unseal at the Ledger next to yours. Copying the loudest voice at the table is how books die.
          </Tip>
        )}
        {CHARACTER_ORDER.map((k) => {
          const meta = CHARACTER_META[k];
          const report = punditFinal[k];
          if (!report) return null;
          const lean = bucket(report.p);
          const tapped = peekChoice === k;
          const tappable = peekArmed && !peekChoice;
          return (
            <div
              key={k}
              className={`ct-lean ${tappable ? "tappable" : ""}`}
              style={{ "--cc": meta.color }}
              onClick={() => { if (tappable) onPeek(k); }}
            >
              <img src={meta.portrait} alt={meta.name} />
              <div>
                <div className="ct-lean-name">{meta.name}{patron === k ? " ⟡" : ""} <span className="ct-lean-scan">read {report.scanned.map((s) => CHARACTER_META[s].role).join(" + ")}{mods[k] ? ` · played ${BOT_SIG[k].card}` : ""}{busted[k] ? " · book gone — calls anyway" : ""}</span></div>
                <div className="ct-lean-line">“{LEAN_LINES[k][lean]}”</div>
                {tapped && (
                  <div className="ct-wiretap">⟡ WIRETAP: {VLABEL[bucket(report.p)]} @ {Math.round(report.p * 100)}% scam</div>
                )}
              </div>
            </div>
          );
        })}
        {peekArmed && !peekChoice && <div className="ct-talk-note" style={{ color: "#ffd23a" }}>⟡ Insider Ping live — tap a partner to unseal their number.</div>}
        <button className="ct-cta" onClick={onCommit}>COMMIT YOUR POSITION ▸</button>
        <button className="ct-ghost" onClick={onBack}>◀ BACK TO THE DESK</button>
      </div>
    </Shell>
  );
}
