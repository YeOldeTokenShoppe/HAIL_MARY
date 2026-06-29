"use client";
import React from "react";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";

// Reveal screen — outcome + Brier + the case truth + each consultant's
// vindication line + the decisive lens. Self-contained off the case data.
const OUT = {
  aligned: { label: "ALIGNED", color: "#4dffaa", sub: "you called it" },
  missed: { label: "MISSED", color: "#ff5454", sub: "wrong read" },
  abstained: { label: "ABSTAINED", color: "#ffd23a", sub: "you held back" },
};

// vindication values are sometimes {text,audio}, sometimes a bare string.
const vtext = (v) => (typeof v === "string" ? v : v?.text || "");

export default function RevealScreen({ caseData, verdict, confidence = 0.5, onExit }) {
  const correct = caseData.correctVerdict;
  const outcome = verdict === "abstain" ? "abstained" : verdict === correct ? "aligned" : "missed";
  const o = OUT[outcome];
  const wasScam = correct === "doubt";
  const brier = Math.pow(confidence - (wasScam ? 1 : 0), 2);
  const decisive = (caseData.decisiveLenses || [])
    .map((k) => `${CHARACTER_META[k]?.role} · ${CHARACTER_META[k]?.name}`)
    .filter(Boolean);

  return (
    <div className="rv-root">
      <div className="rv-header"><span className="rv-title">CASE CLOSED · {caseData.ticker}</span></div>

      <div className="rv-body">
        <div className="rv-banner" style={{ "--c": o.color }}>
          <span className="rv-out">{o.label}</span>
          <span className="rv-sub">{o.sub}</span>
          <span className="rv-brier">BRIER {brier.toFixed(2)} <i>· 0 = perfect</i></span>
        </div>

        {caseData.reveal?.summary && <div className="rv-truth">{caseData.reveal.summary}</div>}
        {caseData.reveal?.voices?.[verdict] && <div className="rv-narr">{caseData.reveal.voices[verdict]}</div>}

        {decisive.length > 0 && (
          <div className="rv-decisive">✦ DECISIVE LENS — {decisive.join(", ")}</div>
        )}

        <div className="rv-vhead">THE COUNCIL WEIGHS IN</div>
        <div className="rv-vinds">
          {CHARACTER_ORDER.map((k) => {
            const v = caseData.stations[k]?.vindication?.[outcome];
            const meta = CHARACTER_META[k];
            const text = vtext(v);
            if (!text) return null;
            return (
              <div key={k} className="rv-vind" style={{ "--c": meta.color }}>
                <span className="rv-vname">{meta.sigil} {meta.name}</span>
                <span className="rv-vtext">{text}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button className="rv-exit" onClick={onExit}>◀ RETURN TO TERMINAL</button>

      <style>{`
        .rv-root { position: absolute; inset: 0; display: flex; flex-direction: column;
          background: radial-gradient(120% 80% at 50% 20%, rgba(10,40,38,0.4), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; overflow: hidden; user-select: none; }
        .rv-root::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 9;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 3px),
                      radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.55)); mix-blend-mode: multiply; }
        .rv-header { padding: 14px; font-size: 12px; letter-spacing: 0.06em; }
        .rv-title { color: #5ff2f2; font-weight: bold; }
        .rv-body { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 16px 14px; z-index: 6; }
        .rv-banner { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 16px;
          border: 1.5px solid var(--c); color: var(--c); margin-bottom: 16px;
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
          box-shadow: inset 0 0 26px color-mix(in srgb, var(--c) 16%, transparent); }
        .rv-out { font-size: 30px; font-weight: bold; letter-spacing: 0.08em; text-shadow: 0 0 14px var(--c); }
        .rv-sub { font-size: 11px; letter-spacing: 0.1em; opacity: 0.85; }
        .rv-brier { font-size: 13px; color: #eafff9; margin-top: 6px; }
        .rv-brier i { color: #2fd6d6; opacity: 0.7; font-style: normal; font-size: 10px; }
        .rv-truth { font-size: 13px; line-height: 1.55; color: #d6fff6; border-left: 2px solid #2fd6d6; padding: 4px 0 4px 12px; margin-bottom: 12px; }
        .rv-narr { font-size: 12.5px; line-height: 1.55; color: #bfeede; opacity: 0.92; margin-bottom: 14px; }
        .rv-decisive { font-size: 11.5px; letter-spacing: 0.06em; color: #ffd23a; margin-bottom: 16px;
          border: 1px dashed color-mix(in srgb, #ffd23a 50%, transparent); padding: 8px 10px; }
        .rv-vhead { font-size: 10.5px; letter-spacing: 0.14em; color: #2fd6d6; opacity: 0.8; margin-bottom: 9px; }
        .rv-vinds { display: flex; flex-direction: column; gap: 9px; }
        .rv-vind { border-left: 2px solid var(--c); padding: 5px 0 6px 11px; }
        .rv-vname { display: block; font-size: 12px; font-weight: bold; color: var(--c); letter-spacing: 0.03em; }
        .rv-vtext { display: block; font-size: 12.5px; line-height: 1.45; color: #eafff9; margin-top: 2px; }
        .rv-exit { margin: 8px 16px calc(env(safe-area-inset-bottom, 0px) + 16px); z-index: 6;
          background: none; border: 1px solid color-mix(in srgb, #2fd6d6 50%, transparent); color: #2fd6d6; font: inherit;
          font-size: 12px; letter-spacing: 0.06em; padding: 11px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px)); }
      `}</style>
    </div>
  );
}
