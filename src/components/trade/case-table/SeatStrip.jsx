// The five-seat header strip: your book + the four partners', with per-case
// P&L when a settled ledger is showing. Styles live in Shell's ct- sheet.
import React from "react";
import { CHARACTER_META } from "@/components/CaseFile/characterMeta";
import { YOU } from "@/game/terminal-traders/docketRun";
import { SEATS, START_PF, seatMeta } from "./constants";

export default function SeatStrip({ books, busted, ledger, patron, showPnl }) {
  return (
    <div className="ct-strip">
      {SEATS.map((k) => {
        const meta = seatMeta(k);
        const row = ledger?.find((r) => r.seat === k);
        return (
          <div key={k} className={`ct-seat ${k === YOU ? "you" : ""} ${busted[k] ? "liq" : ""}`} style={{ "--cc": meta.color }}>
            {meta.portrait
              ? <img src={meta.portrait} alt={meta.name} />
              : <div className="ct-seat-you">◈{patron ? <img className="ct-patron-chip" src={CHARACTER_META[patron].portrait} alt="patron" title="your patron" /> : null}</div>}
            <div className="ct-seat-name">{k === YOU ? "YOUR BOOK" : meta.name.split(" ").pop().toUpperCase()}</div>
            <div className="ct-seat-pf">
              {busted[k] && !row?.justBusted ? "OFF DESK" : Math.round(books[k] ?? START_PF)}
              {showPnl && row && !row.out && (
                <span className="ct-pnl" style={{ color: row.pnl >= 0 ? "#4dffaa" : "#ff5454" }}>
                  {" "}{row.pnl >= 0 ? "+" : ""}{Math.round(row.pnl)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
