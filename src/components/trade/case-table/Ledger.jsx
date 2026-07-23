// The Ledger: truth unseals, all five positions and their P&L go on the
// record, your ticket's named dial lines (sizing debrief, horizon, stop
// loss) get read out, and the between-cases market flip lands.
import React from "react";
import { HORIZON, HORIZON_HIT, HORIZON_MISS, STOP_LOSS_FLOOR, YOU, bucket } from "@/game/terminal-traders/docketRun";
import { VLABEL, seatMeta } from "./constants";
import Shell from "./Shell";
import SeatStrip from "./SeatStrip";

export default function Ledger({
  ticker, truth, caseIndex, docketLength,
  books, busted, patron, rows,
  kitPlays = [], // structured kit plays from CaseTable — information plays get debrief lines
  overageSpent = 0, // the research tab: book points billed beyond the free budget
  pendingEvent, shieldSpent, monkShieldHeld,
  onAdvance,
}) {
  // One debrief line per INFORMATION play (insurance/trace already have their
  // own dial lines above). Rides a parallel prop, never settleCase's rows —
  // those are parity-pinned.
  const kitLine = (k) => {
    const st = k.station ? seatMeta(k.station)?.name : null;
    if (k.connectionLabel) return `connected ${(k.lenses || []).map((l) => seatMeta(l)?.name).join(" + ")}: ${k.connectionLabel}`;
    if (k.kind === "crossref") return `crosscheck pulled ${k.tier1} card${k.tier1 === 1 ? "" : "s"}`;
    if (k.kind === "deepScan") return `opened ${st}'s archive: ${k.tier1} entr${k.tier1 === 1 ? "y" : "ies"} · ${k.deep} CLASSIFIED${k.unlockedStation ? " · 1 sealed question" : ""}`;
    return `${st} slid ${k.tier1} card${k.tier1 === 1 ? "" : "s"}`;
  };
  return (
    <Shell>
      <div className="ct-talk">
        <SeatStrip books={books} busted={busted} ledger={rows} patron={patron} showPnl />
        <div className="ct-eyebrow">▸ THE LEDGER — DEAL {caseIndex + 1}/{docketLength}</div>
        <div className="ct-truth" style={{ color: truth ? "#ff5454" : "#4dffaa" }}>
          {ticker} WAS {truth ? "A RUG" : "LEGIT"}
        </div>
        {rows?.map((row) => {
          if (row.out) return null;
          const meta = seatMeta(row.seat);
          const v = bucket(row.p);
          return (
            <div key={row.seat} className="ct-lean" style={{ "--cc": meta.color }}>
              {meta.portrait ? <img src={meta.portrait} alt={meta.name} /> : <div className="ct-you-badge">◈</div>}
              <div className="ct-ledger-row">
                <div className="ct-lean-name">{row.seat === YOU ? "YOU" : meta.name}
                  <span className="ct-lean-scan"> {VLABEL[v]} @ {Math.round(row.p * 100)}% scam · stake {row.stake}{row.bold ? " · DEVIL'S LEVERAGE ×1.25" : ""}</span></div>
                <div className="ct-ledger-nums">
                  <span style={{ color: row.pnl >= 0 ? "#4dffaa" : "#ff5454" }}>{row.pnl >= 0 ? "+" : ""}{Math.round(row.pnl)}</span>
                  <span className="ct-dim"> → {Math.round(row.book)}</span>
                  {row.justBusted && <span className="ct-rug"> {row.seat === YOU ? "OFF THE DESK" : "BOOK GONE"}</span>}
                </div>
                {row.seat === YOU && row.sizing && (
                  <div className="ct-debrief">
                    ◈ SIZING — {row.sizing.verdict === "centered"
                      ? "a dead-center call: the stake never mattered"
                      : row.sizing.verdict === "sized"
                        ? `sized to your conviction (${Math.round(row.p * 100)}% justifies ~${row.sizing.justified})`
                        : row.sizing.verdict === "oversized"
                          ? `oversized — ${Math.round(row.p * 100)}% conviction justifies ~${row.sizing.justified}, you staked ${row.stake}`
                          : `timid — ${Math.round(row.p * 100)}% conviction justifies ~${row.sizing.justified}, you staked ${row.stake}`}
                  </div>
                )}
                {row.seat === YOU && row.horizon && (
                  <div className="ct-debrief" style={{ color: row.horizon.hit ? "#4dffaa" : "#ff5454" }}>
                    ⌛ HORIZON {HORIZON[row.horizon.idx].label} — {row.horizon.hit
                      ? `hit: it unraveled day ${row.horizon.day} (+${HORIZON_HIT})`
                      : truth === 1
                        ? `missed: it unraveled day ${row.horizon.day} (${HORIZON_MISS})`
                        : `it never rugged (${HORIZON_MISS})`}
                  </div>
                )}
                {row.seat === YOU && row.stopLoss && (
                  <div className="ct-debrief" style={{ color: "#4dffaa" }}>
                    ⟡ NEON STOP LOSS — a {row.stopLoss.from} ticket capped at {STOP_LOSS_FLOOR}
                  </div>
                )}
                {row.seat === YOU && kitPlays
                  .filter((k) => ["lensKey", "deepScan", "crossref"].includes(k.kind))
                  .map((k) => (
                    <div key={k.id} className="ct-debrief" style={{ color: "#8ee9ff" }}>
                      ⟡ {k.name.toUpperCase()} — {kitLine(k)}
                    </div>
                  ))}
                {row.seat === YOU && overageSpent > 0 && (
                  <div className="ct-debrief" style={{ color: "#ff8a4d" }}>
                    ◈ RESEARCH TAB — the desk billed −{overageSpent} for looks beyond the free three
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {pendingEvent && (
          <div className={`ct-event${pendingEvent.id === "calm" ? " ct-event--calm" : ""}`}>
            <div className="ct-event-label">◈ MARKET FLIPS BETWEEN DEALS — {pendingEvent.label}</div>
            <div className="ct-event-text">{pendingEvent.text}</div>
            <div className="ct-event-effect">EFFECT · {pendingEvent.effect}</div>
            {shieldSpent && pendingEvent.portfolioAll < 0 && (
              <div className="ct-event-text" style={{ color: "#4dffaa" }}>Your shield absorbs the hit — your book takes nothing.</div>
            )}
            {pendingEvent.portfolioAll < 0 && monkShieldHeld && (
              <div className="ct-event-text" style={{ color: "#daa520" }}>GR80's cold storage holds — he takes nothing.</div>
            )}
          </div>
        )}
        <button className="ct-cta" onClick={onAdvance}>
          {busted[YOU] ? "OFF THE DESK — SEE STANDINGS ▸" : caseIndex >= docketLength - 1 ? "FINAL STANDINGS ▸" : "NEXT DEAL ▸"}
        </button>
      </div>
    </Shell>
  );
}
