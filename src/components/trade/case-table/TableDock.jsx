// The table dock — pinned under ChannelView during a channel visit: live
// desk feed + actions/book readout + the kit hand (passed in as the small
// <KitHand>, so the dock stays ignorant of kit rules).
import React from "react";
import { BOT_ROUNDS } from "@/game/terminal-traders/docketRun";
import { DOCK_H, START_PF } from "./constants";
import { KC_CSS } from "./KitCard";

export default function TableDock({ tableLog, actionsUsed, actionsMax, book, kitHand }) {
  return (
    <div className="td-root">
      <div className="td-feed">
        {tableLog.length === 0
          ? <div className="td-line td-dim">▸ Round 1 of {BOT_ROUNDS}. An action = a question or a card. The desk moves when you do.</div>
          : tableLog.slice(-2).map((line, i) => <div key={tableLog.length + "-" + i} className="td-line">{line}</div>)}
      </div>
      <div className="td-handrow">
        <span className={`td-actions${actionsMax - actionsUsed === 1 ? " low" : ""}`} title="An action = one question or one card">
          <span className="td-actions-label">ACTIONS</span>
          <span className="td-actions-num">{Math.max(0, actionsMax - actionsUsed)}<i className="td-actions-max">/{actionsMax}</i></span>
          <span className="td-actions-pips">
            {Array.from({ length: actionsMax }, (_, i) => (
              <i key={i} className={`td-apip${i < actionsMax - actionsUsed ? " on" : ""}`} />
            ))}
          </span>
          <span className="td-book" title="Your allocated book — the ticket stakes come out of this">
            ◈ BOOK {Math.round(book ?? START_PF)}
          </span>
        </span>
        <div className="td-hand">{kitHand}</div>
      </div>
      <style>{`
        .td-root { position: absolute; left: 0; right: 0; bottom: 0; height: ${DOCK_H}px; z-index: 10070;
          background: #030f0c; border-top: 1px solid rgba(255,210,58,0.45);
          font-family: 'Courier New', monospace; display: flex; flex-direction: column; padding: 6px 10px calc(env(safe-area-inset-bottom, 0px) + 6px); }
        .td-feed { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
        .td-line { font-size: 10.5px; color: #eafff9; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .td-dim { color: #bfeede; opacity: 0.7; }
        .td-handrow { display: flex; align-items: center; gap: 10px; margin-top: 5px; min-height: 0; }
        .td-actions { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; padding: 0 4px; }
        .td-actions-label { font-size: 9.5px; font-weight: bold; color: #ffd23a; letter-spacing: 0.14em; }
        .td-actions-num { font-size: 24px; font-weight: bold; color: #f4fffb; line-height: 1;
          text-shadow: 0 0 12px rgba(255,210,58,0.55); }
        .td-actions-max { font-size: 12px; font-style: normal; font-weight: normal; color: #bfeede; opacity: 0.6; }
        .td-actions-pips { display: flex; gap: 5px; }
        .td-apip { width: 13px; height: 13px; border: 1.5px solid #ffd23a; opacity: 0.28;
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px)); }
        .td-apip.on { background: #ffd23a; opacity: 1; box-shadow: 0 0 8px rgba(255,210,58,0.7); }
        .td-actions.low .td-apip.on { animation: dgpulse 0.9s ease-in-out infinite; }
        @keyframes dgpulse { 50% { opacity: 0.45; box-shadow: 0 0 4px rgba(255,210,58,0.3); } }
        .td-book { font-size: 10px; font-weight: bold; letter-spacing: 0.08em; color: #2fd6d6;
          margin-top: 3px; text-shadow: 0 0 8px rgba(47,214,214,0.45); white-space: nowrap; }
        .td-hand { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 0; }
        .td-hand::-webkit-scrollbar { display: none; }
        ${KC_CSS}
      `}</style>
    </div>
  );
}
