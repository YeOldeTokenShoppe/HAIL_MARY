"use client";
import React, { useState } from "react";

// Verdict screen — a single confidence dial (P scam). Left = TRUST, center
// deadzone = ABSTAIN, right = DOUBT (matches the rulesIntro). Commit → reveal.
function deriveVerdict(p) {
  if (p < 0.4) return "believe";
  if (p > 0.6) return "doubt";
  return "abstain";
}
const VLABEL = { believe: "TRUST", doubt: "DOUBT", abstain: "ABSTAIN" };
const VCOLOR = { believe: "#4dffaa", doubt: "#ff5454", abstain: "#ffd23a" };

export default function VerdictScreen({ caseData, onCommit, onBack }) {
  const [val, setVal] = useState(50); // 0..100 → P(scam)
  const p = val / 100;
  const verdict = deriveVerdict(p);
  const color = VCOLOR[verdict];
  const conf = verdict === "abstain"
    ? "no call — spared either way"
    : `${Math.round((verdict === "doubt" ? p : 1 - p) * 100)}% confident`;

  return (
    <div className="vs-root">
      <div className="vs-header">
        <button className="vs-back" onClick={onBack}>◀ COUNCIL</button>
        <span className="vs-case">{caseData.ticker}</span>
      </div>

      <div className="vs-body">
        <div className="vs-eyebrow">▸ RENDER VERDICT</div>
        <div className="vs-q">Is <b>{caseData.projectName}</b> a scam?</div>

        <div className="vs-readout" style={{ color }}>
          <span className="vs-verdict">{VLABEL[verdict]}</span>
          <span className="vs-conf">{conf}</span>
        </div>

        <input
          className="vs-slider" type="range" min="0" max="100" value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          style={{ "--c": color }}
        />
        <div className="vs-scale">
          <span style={{ color: VCOLOR.believe }}>◂ TRUST</span>
          <span style={{ color: VCOLOR.abstain }}>ABSTAIN</span>
          <span style={{ color: VCOLOR.doubt }}>DOUBT ▸</span>
        </div>

        <div className="vs-note">A bold, correct call scores best. A bold, wrong one cuts deepest. Centered is spared.</div>
      </div>

      <button className="vs-commit" style={{ "--c": color }} onClick={() => onCommit({ verdict, confidence: p })}>
        COMMIT VERDICT ▸
      </button>

      <style>{`
        .vs-root { position: absolute; inset: 0; display: flex; flex-direction: column;
          background: radial-gradient(120% 80% at 50% 30%, rgba(10,40,38,0.4), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; overflow: hidden; user-select: none; }
        .vs-root::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 9;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 3px),
                      radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.55)); mix-blend-mode: multiply; }
        .vs-header { display: flex; align-items: center; justify-content: space-between; padding: 14px; font-size: 12px; letter-spacing: 0.05em; }
        .vs-back { background: none; border: 1px solid color-mix(in srgb, #2fd6d6 50%, transparent); color: #2fd6d6; font: inherit; padding: 4px 10px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
        .vs-case { color: #ffd23a; }
        .vs-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 18px; z-index: 6; display: flex; flex-direction: column; justify-content: center; }
        .vs-eyebrow { font-size: 11px; letter-spacing: 0.14em; color: #ffd23a; }
        .vs-q { font-size: 18px; color: #eafff9; margin: 10px 0 26px; }
        .vs-q b { color: #fff; }
        .vs-readout { display: flex; flex-direction: column; align-items: center; gap: 4px; text-shadow: 0 0 14px currentColor; }
        .vs-verdict { font-size: 34px; font-weight: bold; letter-spacing: 0.06em; }
        .vs-conf { font-size: 12px; letter-spacing: 0.06em; opacity: 0.9; }
        .vs-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 8px;
          background: linear-gradient(90deg, #1c7a52 0%, #7a6a1c 50%, #7a1c1c 100%); outline: none; margin: 22px 0 10px; }
        .vs-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 30px; background: var(--c);
          border: 1px solid #f4fffb; cursor: pointer; box-shadow: 0 0 12px var(--c); }
        .vs-slider::-moz-range-thumb { width: 16px; height: 30px; background: var(--c); border: 1px solid #f4fffb; cursor: pointer; box-shadow: 0 0 12px var(--c); }
        .vs-scale { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 0.05em; margin-bottom: 22px; }
        .vs-note { font-size: 11.5px; line-height: 1.5; color: #bfeede; opacity: 0.8; text-align: center; }
        .vs-commit { margin: 8px 18px calc(env(safe-area-inset-bottom, 0px) + 16px); z-index: 6;
          background: color-mix(in srgb, var(--c) 18%, #04140f); border: 1.5px solid var(--c); color: #f4fffb; font: inherit; font-weight: bold;
          letter-spacing: 0.08em; font-size: 15px; padding: 14px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: 0 0 16px color-mix(in srgb, var(--c) 40%, transparent); }
      `}</style>
    </div>
  );
}
