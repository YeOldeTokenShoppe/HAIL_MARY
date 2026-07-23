"use client";
import React, { useEffect, useState } from "react";
import TradingCard from "@/components/TradingCard";
import PriceGlimpse from "@/components/trade/PriceGlimpse";
import { frameForRarity, metaTopForFrame } from "@/game/terminal-traders/cardFrames";

// The Liminal Terminal MENU — the entry screen that fronts the COUNCIL grid
// (replaces the old credo CRT). The incoming case renders as a real
// TradingCard dossier (frame tier = difficulty ladder) with its surface
// stats beside it. BEGIN → kit; BRIEFING toggles GR80's rules; EXIT → lobby.
const DIFFICULTY_TIER = { beginner: "common", intermediate: "rare", advanced: "mythic", review: "uncommon" };

// A synthetic template-card for the case file — cases aren't Genesis cards,
// so this builds the TradingCard data shape directly (no art → the framed
// no-art variant; no Genesis set badge). Exported: DealHand renders the
// prospect SPREAD with the same dossier cards.
export function caseDossierCard(caseData, caseIndex, docketLength) {
  const frame = frameForRarity(DIFFICULTY_TIER[caseData.difficulty] || "common");
  const difficulty = caseData.difficulty
    ? caseData.difficulty.charAt(0).toUpperCase() + caseData.difficulty.slice(1)
    : "Docket";
  return {
    name: caseData.projectName,
    subtitle: `${caseData.ticker} · ${caseData.chain}`,
    cardType: "Prospect",
    style: difficulty,
    rarity: difficulty,
    foilStyle: "subtle",
    edition: docketLength ? `${(caseIndex ?? 0) + 1}/${docketLength}` : "dossier",
    ability: { name: "Position Required", text: caseData.tagline },
    flavorText: "Long, short, or hold? Work the lenses. Lock the ticket.",
    statPair: null,
    backgroundImage: null,
    artFocus: "center 30%",
    artZoom: 1,
    frameImage: frame,
    frameMetaTop: metaTopForFrame(frame),
    fxOverlays: [],
    fxBlend: "normal",
    fxOpacity: 1,
    setBadge: null,
  };
}

export default function TerminalMenu({ caseData, caseIndex = 0, docketLength = 0, onBegin, onSkip, onExit, exitLabel = "◀ EXIT TERMINAL" }) {
  const [showBriefing, setShowBriefing] = useState(false);
  // The dossier card scales down a notch on phones so the stats column
  // still fits beside it (or stacks cleanly below).
  const [cardScale, setCardScale] = useState(0.36);
  useEffect(() => {
    const fit = () => setCardScale(window.innerWidth < 700 ? 0.3 : 0.36);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const m = caseData.surfaceMetrics || {};
  const up = String(m.change24h || "").trim().startsWith("+");
  const metrics = [
    ["AGE", m.age], ["MCAP", m.mcap], ["HOLDERS", m.holders],
    ["PRICE", m.price], ["24H", m.change24h], ["SOCIAL", m.socialScore],
  ];
  const caseNo = (caseData.id || "").replace(/\D/g, "") || "—";

  return (
    <div className="tm-root">
      <div className="tm-header">
        <span className="tm-title">LIMINAL // RL80</span>
        <span className="tm-live"><i className="tm-dot" />ONLINE</span>
      </div>

      <div className="tm-body">
        <div className="tm-eyebrow">▸ INCOMING PROSPECT · {caseNo}</div>
        <div className="tm-dossier">
          <div className="tm-cardwrap">
            <TradingCard
              data={caseDossierCard(caseData, caseIndex, docketLength)}
              scale={cardScale}
              templateStyle="terminal"
            />
          </div>
          <div className="tm-stats">
            {/* tagline lives on the card itself (Verdict Required box) */}
            <div className="tm-metrics">
              {metrics.map(([k, v]) => (
                <div key={k} className="tm-metric">
                  <span className="tm-mk">{k}</span>
                  <span className={`tm-mv${k === "24H" ? (up ? " tm-up" : " tm-down") : ""}`}>{v || "—"}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 9 }}>
              <PriceGlimpse caseData={caseData} />
            </div>
            <div className="tm-charge">POSITION REQUIRED — long, short, or hold?</div>
          </div>
        </div>

        <button className="tm-begin" onClick={onBegin}>▸ DO YOUR OWN RESEARCH</button>
        {/* The viber path (playtest 2026-07-22): research is optional. The
            chart and the room are free; the receipts cost actions. Sim says
            this path roughly breaks even — the recap will say so too. */}
        {onSkip && (
          <button className="tm-skip" onClick={onSkip}>⚡ SKIP IT — TRADE THE CHART ▸</button>
        )}

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
        /* Dossier spread: the case's TradingCard beside its stat column;
           stacks when the viewport can't seat them side by side. */
        .tm-dossier { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }
        .tm-cardwrap { flex: 0 0 auto; margin: 0 auto; }
        .tm-stats { flex: 1; min-width: 250px; display: flex; flex-direction: column; }
        .tm-tagline { font-size: 12.5px; color: #bfeede; opacity: 0.9; margin: 0 0 14px; line-height: 1.4; }
        .tm-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
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
        .tm-skip {
          width: 100%; background: none; border: 1px solid color-mix(in srgb, #ff8a4d 50%, transparent);
          color: #ff8a4d; font: inherit; font-size: 12.5px; font-weight: bold; letter-spacing: 0.08em;
          padding: 11px 12px; cursor: pointer; margin-bottom: 12px;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
        .tm-skip:hover { background: rgba(255,138,77,0.08); }
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
