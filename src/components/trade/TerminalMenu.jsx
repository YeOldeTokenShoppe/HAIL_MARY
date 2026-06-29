"use client";
import React, { useState } from "react";

// The Liminal Terminal MENU — the entry screen that fronts the COUNCIL grid
// (replaces the old credo CRT). Presents the incoming case file + entry options.
// BEGIN → grid; BRIEFING toggles St. GR80's rules inline; EXIT → back to laptop.
export default function TerminalMenu({ caseData, onBegin, onExit, exitLabel = "◀ EXIT TERMINAL" }) {
  const [showBriefing, setShowBriefing] = useState(false);
  const m = caseData.surfaceMetrics || {};
  const up = String(m.change24h || "").trim().startsWith("+");
  const metrics = [
    ["AGE", m.age], ["MCAP", m.mcap], ["HOLDERS", m.holders],
    ["PRICE", m.price], ["24H", m.change24h], ["SOCIAL", m.socialScore],
  ];

  return (
    <div className="tm-root">
      <div className="tm-header">
        <span className="tm-title">LIMINAL // RL80</span>
        <span className="tm-live"><i className="tm-dot" />ONLINE</span>
      </div>

      <div className="tm-body">
        <div className="tm-eyebrow">▸ INCOMING CASE FILE · 001</div>
        <div className="tm-card">
          <div className="tm-proj">{caseData.projectName}</div>
          <div className="tm-sub">{caseData.ticker} · {caseData.chain}</div>
          <div className="tm-tagline">{caseData.tagline}</div>
          <div className="tm-metrics">
            {metrics.map(([k, v]) => (
              <div key={k} className="tm-metric">
                <span className="tm-mk">{k}</span>
                <span className={`tm-mv${k === "24H" ? (up ? " tm-up" : " tm-down") : ""}`}>{v || "—"}</span>
              </div>
            ))}
          </div>
          <div className="tm-charge">VERDICT REQUIRED — scam, or salvation?</div>
        </div>

        <button className="tm-begin" onClick={onBegin}>▸ BEGIN INVESTIGATION</button>

        <button className="tm-brief" onClick={() => setShowBriefing((s) => !s)}>
          {showBriefing ? "▾" : "▸"} BRIEFING · ST. GR80
        </button>
        {showBriefing && caseData.rulesIntro?.text && (
          <div className="tm-rules">{caseData.rulesIntro.text}</div>
        )}
      </div>

      <button className="tm-exit" onClick={onExit}>{exitLabel}</button>

      <style>{`
        .tm-root {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background: radial-gradient(120% 80% at 50% 25%, rgba(10,40,38,0.4), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; overflow: hidden; user-select: none;
        }
        .tm-root::after {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 9;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 3px),
                      radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.55));
          mix-blend-mode: multiply;
        }
        .tm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 14px 10px; font-size: 13px; letter-spacing: 0.05em;
        }
        .tm-title { color: #5ff2f2; font-weight: bold; }
        .tm-live { display: inline-flex; align-items: center; gap: 6px; }
        .tm-dot { width: 7px; height: 7px; border-radius: 50%; background: #4dffaa; box-shadow: 0 0 6px #4dffaa; }

        .tm-body { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 14px 14px; z-index: 6; }
        .tm-eyebrow { font-size: 11px; letter-spacing: 0.14em; color: #ffd23a; margin-bottom: 10px; }
        .tm-card {
          border: 1.5px solid color-mix(in srgb, #2fd6d6 55%, transparent); padding: 14px;
          background: #061a18; margin-bottom: 18px;
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          box-shadow: inset 0 0 26px color-mix(in srgb, #2fd6d6 16%, transparent);
        }
        .tm-proj { font-size: 26px; font-weight: bold; color: #f4fffb; letter-spacing: 0.02em; text-shadow: 0 0 10px rgba(47,214,214,0.4); }
        .tm-sub { font-size: 13px; color: #ffd23a; margin-top: 2px; }
        .tm-tagline { font-size: 12.5px; color: #bfeede; opacity: 0.9; margin: 8px 0 14px; line-height: 1.4; }
        .tm-metrics { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9px; }
        .tm-metric {
          border: 1px solid color-mix(in srgb, #2fd6d6 28%, transparent); padding: 7px 8px;
          display: flex; flex-direction: column; gap: 2px; background: #04140f;
        }
        .tm-mk { font-size: 9px; letter-spacing: 0.1em; color: #2fd6d6; opacity: 0.7; }
        .tm-mv { font-size: 14px; color: #eafff9; font-weight: bold; }
        .tm-up { color: #4dffaa; } .tm-down { color: #ff6b6b; }
        .tm-charge { font-size: 11px; letter-spacing: 0.08em; color: #ffd23a; margin-top: 14px; opacity: 0.9; }

        .tm-begin {
          width: 100%; background: color-mix(in srgb, #2fd6d6 18%, #04140f);
          border: 1.5px solid #2fd6d6; color: #f4fffb; font: inherit; font-weight: bold;
          font-size: 15px; letter-spacing: 0.08em; padding: 15px; cursor: pointer; margin-bottom: 12px;
          clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 13px 100%, 0 calc(100% - 13px));
          box-shadow: 0 0 16px color-mix(in srgb, #2fd6d6 40%, transparent);
        }
        .tm-begin:active { transform: scale(0.99); }
        .tm-brief {
          width: 100%; background: none; border: 1px solid color-mix(in srgb, #ffd23a 45%, transparent);
          color: #ffd23a; font: inherit; font-size: 12.5px; letter-spacing: 0.06em; text-align: left;
          padding: 11px 12px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
        .tm-rules {
          font-size: 12.5px; line-height: 1.55; color: #d6fff6; margin-top: 10px;
          border-left: 2px solid #ffd23a; padding: 4px 0 4px 12px;
        }

        .tm-exit {
          margin: 8px 14px calc(env(safe-area-inset-bottom, 0px) + 14px); z-index: 6;
          background: none; border: 1px solid color-mix(in srgb, #2fd6d6 45%, transparent);
          color: #2fd6d6; font: inherit; font-size: 12px; letter-spacing: 0.06em; padding: 10px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
      `}</style>
    </div>
  );
}
