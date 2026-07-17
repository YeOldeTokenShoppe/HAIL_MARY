// The desk (grid screen): four card-sized channel tiles + the kit as
// same-sized, card-shaped cards (passed in as the full-size <KitHand>).
// Two-tap card flow: arm, then play.
import React from "react";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";
import { BASE_ACTIONS, BOT_ROUNDS } from "@/game/terminal-traders/docketRun";
import { START_PF } from "./constants";
import { KC_CSS } from "./KitCard";
import Tip from "./Tip";

export default function DeskGrid({
  caseData, caseIndex, docketLength, visited, tableLog,
  tipSeen, onDismissTip, actionsLeft, actionsMax, book, callsOpen,
  onOpenChannel, onEnterCalls, kitHand,
}) {
  return (
    <div className="dg-root">
      <div className="dg-inner">
        <div className="dg-header">
          <span className="dg-title">LIMINAL // COUNCIL</span>
          <span className="dg-case">{caseData.ticker} · {caseData.chain} — CASE {caseIndex + 1}/{docketLength}</span>
          <span className="dg-live"><i className="dg-dot" />4 CHANNELS</span>
        </div>

        {!tipSeen && (
          <Tip title="THE DESK — FIRST TIME" onDismiss={onDismissTip}>
            You get {BASE_ACTIONS} ACTIONS a case. Opening a channel and asking a question costs one;
            playing a kit card costs one. The partners work the case every time you spend one — watch
            the desk feed. Out of actions, you call the table.
          </Tip>
        )}

        <div className="dg-eyebrow">▸ THE COUNCIL — OPEN A CHANNEL</div>
        <div className="dg-row">
          {CHARACTER_ORDER.map((key, i) => {
            const c = CHARACTER_META[key];
            const isVisited = visited.includes(key);
            return (
              <button
                key={key}
                className="dg-card dg-agent"
                style={{ "--cc": c.color }}
                onClick={() => onOpenChannel(key)}
              >
                <span className="dg-feed">
                  <img src={c.portrait} alt={c.name} draggable={false} />
                  <span className="dg-tint" />
                  <span className="dg-scanlines" />
                </span>
                <span className="dg-ch">CH-{i + 1}</span>
                <span className="dg-status"><i className={`dg-pip ${isVisited ? "seen" : ""}`} />{isVisited ? "CONSULTED" : "ONLINE"}</span>
                <span className="dg-plate">
                  <span className="dg-name">{c.name}</span>
                  <span className="dg-role">{c.role} · {c.roleSub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="dg-feedstrip">
          {tableLog.length === 0
            ? <div className="dg-line dg-dim">▸ Round 1 of {BOT_ROUNDS}. An action = a question or a card. The desk moves when you do.</div>
            : tableLog.slice(-3).map((line, i) => <div key={tableLog.length + "-" + i} className="dg-line">{line}</div>)}
        </div>

        <div className="dg-eyebrow">▸ YOUR KIT — A CARD COSTS AN ACTION</div>
        <div className="dg-row">{kitHand}</div>

        <div className="dg-footer">
          <div className={`dg-actions${actionsLeft === 1 ? " low" : ""}`} title="An action = one question or one card">
            <span className="dg-actions-label">ACTIONS</span>
            <span className="dg-actions-pips">
              {Array.from({ length: actionsMax }, (_, i) => (
                <i key={i} className={`dg-apip${i < actionsLeft ? " on" : ""}`} />
              ))}
            </span>
            <span className="dg-actions-num">{actionsLeft}<span className="dg-actions-max">/{actionsMax}</span></span>
          </div>
          <div className="dg-book" title="Your allocated book — the ticket stakes come out of this">
            <span className="dg-book-label">◈ YOUR BOOK</span>
            <span className="dg-book-num">{Math.round(book ?? START_PF)}</span>
          </div>
          {callsOpen
            ? <button className="dg-cta" onClick={onEnterCalls}>PUNDIT CALLS ▸</button>
            : <span className="dg-wait">THE TABLE CALLS WHEN YOUR ACTIONS ARE SPENT</span>}
        </div>
      </div>
      <style>{`
        .dg-root { position: absolute; inset: 0; overflow-y: auto;
          background: radial-gradient(120% 80% at 50% 30%, rgba(10,40,38,0.4), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; user-select: none; }
        .dg-root::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 5;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px); }
        .dg-inner { max-width: 1000px; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column;
          gap: 11px; padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px); }
        .dg-header { display: flex; align-items: center; justify-content: space-between; font-size: 13px; letter-spacing: 0.04em; }
        .dg-title { color: #5ff2f2; font-weight: bold; }
        .dg-case { color: #ffd23a; opacity: 0.9; }
        .dg-live { display: inline-flex; align-items: center; gap: 6px; }
        .dg-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4040; box-shadow: 0 0 6px #ff4040;
          animation: dgblink 1.1s steps(1) infinite; }
        @keyframes dgblink { 50% { opacity: 0.25; } }
        .dg-eyebrow { font-size: 10.5px; letter-spacing: 0.14em; color: #ffd23a; }
        .dg-row { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: thin; padding-bottom: 3px; }
        .dg-card { position: relative; flex: 0 0 auto; width: 168px; aspect-ratio: 3 / 4; cursor: pointer;
          border: 1.5px solid color-mix(in srgb, var(--cc) 65%, transparent); background: #061a18;
          color: inherit; font: inherit; text-align: left; padding: 0;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: inset 0 0 18px color-mix(in srgb, var(--cc) 16%, transparent);
          transition: box-shadow 0.15s ease, transform 0.1s ease; }
        .dg-card:hover { box-shadow: inset 0 0 24px color-mix(in srgb, var(--cc) 28%, transparent),
          0 0 12px color-mix(in srgb, var(--cc) 40%, transparent); }
        .dg-card:active { transform: scale(0.98); }
        .dg-feed { position: absolute; inset: 0; overflow: hidden; }
        .dg-feed img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%;
          filter: grayscale(0.4) contrast(1.1) brightness(0.85); }
        .dg-tint { position: absolute; inset: 0; mix-blend-mode: color; opacity: 0.45;
          background: linear-gradient(180deg, transparent 40%, rgba(2,16,14,0.95) 100%), var(--cc); }
        .dg-scanlines { position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.26) 0 1px, transparent 1px 3px); }
        .dg-ch { position: absolute; top: 7px; left: 9px; z-index: 2; font-size: 10px; letter-spacing: 0.08em;
          color: var(--cc); text-shadow: 0 0 6px color-mix(in srgb, var(--cc) 60%, transparent); }
        .dg-status { position: absolute; top: 7px; right: 8px; z-index: 2; display: inline-flex; align-items: center;
          gap: 4px; font-size: 8.5px; letter-spacing: 0.06em; color: #bfeede; }
        .dg-pip { width: 5px; height: 5px; border-radius: 50%; background: #4dffaa; box-shadow: 0 0 5px #4dffaa; }
        .dg-pip.seen { background: #ffd23a; box-shadow: 0 0 5px #ffd23a; }
        .dg-plate { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; display: flex; flex-direction: column;
          gap: 1px; padding: 20px 9px 8px; background: linear-gradient(180deg, transparent, rgba(2,16,14,0.9) 45%); }
        .dg-name { font-size: 12.5px; font-weight: bold; color: #f4fffb;
          text-shadow: 0 0 8px color-mix(in srgb, var(--cc) 65%, transparent); }
        .dg-role { font-size: 8.5px; letter-spacing: 0.12em; color: var(--cc); }
        ${KC_CSS}
        .dg-feedstrip { border: 1px solid rgba(255,210,58,0.28); background: rgba(4,20,15,0.6);
          padding: 7px 10px; min-height: 42px; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
        .dg-line { font-size: 10.5px; color: #eafff9; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dg-dim { opacity: 0.65; }
        .dg-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
        .dg-actions { display: flex; align-items: center; gap: 12px; }
        .dg-actions-label { font-size: 12px; font-weight: bold; letter-spacing: 0.16em; color: #ffd23a; }
        .dg-actions-pips { display: flex; gap: 7px; }
        .dg-apip { width: 20px; height: 20px; border: 2px solid #ffd23a; opacity: 0.28;
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); }
        .dg-apip.on { background: #ffd23a; opacity: 1; box-shadow: 0 0 12px rgba(255,210,58,0.7); }
        .dg-actions.low .dg-apip.on { animation: dgpulse 0.9s ease-in-out infinite; }
        @keyframes dgpulse { 50% { opacity: 0.45; box-shadow: 0 0 4px rgba(255,210,58,0.3); } }
        .dg-actions-num { font-size: 27px; font-weight: bold; color: #f4fffb; line-height: 1;
          text-shadow: 0 0 14px rgba(255,210,58,0.55); }
        .dg-actions-max { font-size: 14px; font-weight: normal; color: #bfeede; opacity: 0.6; }
        .dg-book { display: flex; align-items: baseline; gap: 9px; }
        .dg-book-label { font-size: 10.5px; font-weight: bold; letter-spacing: 0.16em; color: #2fd6d6; opacity: 0.85; }
        .dg-book-num { font-size: 27px; font-weight: bold; color: #f4fffb; line-height: 1;
          text-shadow: 0 0 14px rgba(47,214,214,0.55); }
        .dg-wait { font-size: 10.5px; letter-spacing: 0.08em; color: #bfeede; opacity: 0.6; text-align: right; }
        .dg-cta { background: rgba(47,214,214,0.12); border: 1.5px solid #2fd6d6; color: #f4fffb; font: inherit;
          font-weight: bold; letter-spacing: 0.08em; font-size: 13px; padding: 11px 20px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
          box-shadow: 0 0 12px rgba(47,214,214,0.25); }
      `}</style>
    </div>
  );
}
