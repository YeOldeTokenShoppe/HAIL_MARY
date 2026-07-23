"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getCardById } from "@/game/terminal-traders/cards";
import { toTemplateCard } from "@/game/terminal-traders/templateCard";
import TradingCard from "@/components/TradingCard";
import { caseDossierCard } from "@/components/trade/TerminalMenu";
import PriceGlimpse from "@/components/trade/PriceGlimpse";
import Shell from "./Shell";

// THE DEAL (investor-primary, 2026-07-22) — replaces the KitSelect picker.
// No deckbuilding screen: the collection IS the deck, and the dealer
// (caseKit.dealKit, seeded per prospect) enforces legality. The player's
// moment is the flip — SHUFFLE & DEAL turns the card backs face up — then
// they PLACE THEIR ACTIVE DEAL from the prospect spread (§10.1's Pokémon
// active-slot move: the spread is revealed, you choose which token to
// play). Tap any card to enlarge; tap a prospect to place it.
const THUMB = 0.27;
const PROSPECT_THUMB = 0.24;

export default function DealHand({ hand, poolSize, prospects = [], activeId, onPickProspect, caseIndex, docketLength, onConfirm, onBack }) {
  const [dealt, setDealt] = useState(false);
  const templates = useMemo(
    () => Object.fromEntries(hand.map((c) => [c.id, toTemplateCard(getCardById(c.id))])),
    [hand]
  );

  // Free surface peek (playtest 2026-07-22: "I should be able to DYOR
  // before I choose"): tapping a spread card opens its prospectus — the
  // dossier + public stats. Surface info is free, like a listing page;
  // analyst time only costs once the deal is placed.
  const [peekId, setPeekId] = useState(null);
  const peek = prospects.find((p) => p.id === peekId) || null;

  const [inspectId, setInspectId] = useState(null);
  const [inspectScale, setInspectScale] = useState(0.5);
  useEffect(() => {
    if (!inspectId) return;
    const fit = () => setInspectScale(Math.min(
      (window.innerWidth - 48) / 744,
      (window.innerHeight - 150) / 1038,
      0.62
    ));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [inspectId]);

  return (
    <Shell>
      <div className="ct-talk">
        <div className="ct-lobby-top">
          <div className="ct-eyebrow">▸ THE DEAL — {caseIndex + 1}/{docketLength}</div>
          <button className="ct-dev" onClick={onBack}>◀ LOBBY</button>
        </div>

        {!dealt ? (
          <>
            <div className="ct-title">The dealer racks your hand.</div>
            <div className="ct-sub">
              {hand.length} cards from your {poolSize}-card pool ride this deal. No deckbuilding —
              what you own shapes what you're dealt. A card play costs an action, same as a
              question, and cards are never consumed.
            </div>
            <div className="dh-backs" aria-hidden>
              {hand.map((c, i) => (
                <img
                  key={c.id}
                  src="/TCG/cardBack.webp"
                  alt=""
                  style={{ transform: `rotate(${(i - (hand.length - 1) / 2) * 5}deg) translateY(${Math.abs(i - (hand.length - 1) / 2) * 6}px)` }}
                />
              ))}
            </div>
            <button className="ct-cta" onClick={() => setDealt(true)}>⟡ SHUFFLE &amp; DEAL ▸</button>
          </>
        ) : (
          <>
            <div className="ct-title">Your hand for this deal.</div>
            <div className="dh-row">
              {hand.map((card) => (
                <button
                  key={card.id}
                  className="dh-thumb"
                  onClick={() => setInspectId(card.id)}
                  title={`${card.name} — tap to enlarge`}
                >
                  <TradingCard
                    data={templates[card.id]}
                    scale={THUMB}
                    interactive={false}
                    templateStyle="terminal"
                  />
                </button>
              ))}
            </div>

            {/* The prospect spread — place your active deal (the Pokémon
                active-slot move). One choice, real portfolio agency: the
                tokens you don't place wait in the flow. */}
            {prospects.length > 1 && (
              <>
                <div className="ct-eyebrow" style={{ marginTop: 8 }}>
                  ▸ THE SPREAD — INSPECT THE PROSPECTS, THEN PLACE YOUR ACTIVE DEAL
                </div>
                <div className="dh-row">
                  {prospects.map((p) => {
                    const isActive = activeId === p.id;
                    return (
                      <button
                        key={p.id}
                        className={`dh-prospect${isActive ? " is-active" : ""}`}
                        onClick={() => setPeekId(p.id)}
                        title={`${p.projectName} — inspect the prospectus`}
                      >
                        <TradingCard
                          data={caseDossierCard(p, caseIndex, docketLength)}
                          scale={PROSPECT_THUMB}
                          interactive={false}
                          templateStyle="terminal"
                        />
                        <span className="dh-prospect-tag">{isActive ? "◈ ACTIVE DEAL" : "TAP TO INSPECT"}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button
              className="ct-cta"
              disabled={prospects.length > 1 && !activeId}
              onClick={() => (prospects.length <= 1 || activeId) && onConfirm(hand)}
            >
              {prospects.length > 1 && !activeId
                ? "PLACE A PROSPECT TO CONTINUE"
                : "PLAY THIS HAND — MEET THE PROSPECT ▸"}
            </button>
          </>
        )}
      </div>

      {/* The prospectus peek — free surface DYOR before placing: dossier
          card + the public stats. Deep research costs actions, later. */}
      {peek && (
        <div className="dh-overlay" onClick={() => setPeekId(null)}>
          <div className="dh-peek" onClick={(e) => e.stopPropagation()}>
            <TradingCard
              data={caseDossierCard(peek, caseIndex, docketLength)}
              scale={0.34}
              templateStyle="terminal"
            />
            <div className="dh-peek-side">
              <PriceGlimpse caseData={peek} />
              <div className="dh-peek-metrics">
                {[["AGE", peek.surfaceMetrics?.age], ["MCAP", peek.surfaceMetrics?.mcap],
                  ["HOLDERS", peek.surfaceMetrics?.holders], ["PRICE", peek.surfaceMetrics?.price],
                  ["24H", peek.surfaceMetrics?.change24h], ["SOCIAL", peek.surfaceMetrics?.socialScore],
                ].map(([k, v]) => (
                  <div key={k} className="dh-peek-metric">
                    <span>{k}</span>
                    <b style={k === "24H" ? { color: String(v || "").trim().startsWith("+") ? "#4dffaa" : "#ff6b6b" } : undefined}>{v || "—"}</b>
                  </div>
                ))}
              </div>
              <div className="dh-peek-note">Surface reads are free. The analysts cost actions — once this is your deal.</div>
              <button
                className="ct-cta"
                onClick={() => { onPickProspect?.(peek.id); setPeekId(null); }}
              >
                ◈ PLACE AS ACTIVE DEAL
              </button>
              <button className="ct-ghost" onClick={() => setPeekId(null)}>✕ BACK TO THE SPREAD</button>
            </div>
          </div>
        </div>
      )}

      {/* Full holofoil inspect — same render as the binder. */}
      {inspectId && (
        <div className="dh-overlay" onClick={() => setInspectId(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TradingCard
              data={toTemplateCard(getCardById(inspectId))}
              scale={inspectScale}
              templateStyle="terminal"
            />
          </div>
          <button className="ct-ghost" onClick={() => setInspectId(null)}>✕ CLOSE</button>
        </div>
      )}

      <style>{`
        .dh-backs { display: flex; justify-content: center; padding: 18px 0 26px; }
        .dh-backs img { width: 118px; border-radius: 8px; margin: 0 -26px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.55); border: 1px solid rgba(47,214,214,0.25); }
        .dh-row { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 10px; }
        .dh-thumb { flex: 0 0 auto; background: none; border: none; padding: 2px; cursor: zoom-in;
          transition: transform 0.12s ease; animation: dh-flip 0.4s ease both; }
        .dh-thumb:hover { transform: translateY(-3px); }
        .dh-row .dh-thumb:nth-child(2) { animation-delay: 0.07s; }
        .dh-row .dh-thumb:nth-child(3) { animation-delay: 0.14s; }
        .dh-row .dh-thumb:nth-child(4) { animation-delay: 0.21s; }
        .dh-row .dh-thumb:nth-child(5) { animation-delay: 0.28s; }
        @keyframes dh-flip { from { opacity: 0; transform: translateY(10px) rotateY(70deg); }
          to { opacity: 1; transform: translateY(0) rotateY(0); } }
        .dh-overlay { position: fixed; inset: 0; z-index: 10060; display: flex; flex-direction: column;
          gap: 14px; align-items: center; justify-content: center;
          background: rgba(2,10,9,0.88); backdrop-filter: blur(4px); }
        .dh-prospect { display: flex; flex-direction: column; align-items: center; gap: 6px;
          flex: 0 0 auto; background: none; border: 1.5px solid transparent; border-radius: 12px;
          padding: 3px 3px 8px; cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .dh-prospect:hover { transform: translateY(-3px); }
        .dh-prospect.is-active { border-color: #ffd23a; box-shadow: 0 0 18px rgba(255,210,58,0.4); }
        .dh-prospect-tag { font-size: 9.5px; font-weight: bold; letter-spacing: 0.14em; color: #bfeede; opacity: 0.7; }
        .dh-prospect.is-active .dh-prospect-tag { color: #ffd23a; opacity: 1; text-shadow: 0 0 8px rgba(255,210,58,0.5); }
        .dh-peek { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; justify-content: center;
          max-width: 640px; padding: 18px; }
        .dh-peek-side { display: flex; flex-direction: column; gap: 10px; min-width: 250px; flex: 1; }
        .dh-peek-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dh-peek-metric { display: flex; flex-direction: column; gap: 2px; padding: 7px 9px;
          border: 1px solid rgba(47,214,214,0.28); background: #04140f;
          font-family: 'Courier New', monospace; }
        .dh-peek-metric span { font-size: 9px; letter-spacing: 0.1em; color: #2fd6d6; opacity: 0.7; }
        .dh-peek-metric b { font-size: 14px; color: #eafff9; }
        .dh-peek-note { font-size: 10.5px; line-height: 1.5; color: #bfeede; opacity: 0.75;
          font-family: 'Courier New', monospace; letter-spacing: 0.03em; }
        .ct-cta:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
      `}</style>
    </Shell>
  );
}
