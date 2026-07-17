"use client";
import React, { useEffect, useMemo, useState } from "react";
import { CARD_TYPES, GENESIS_SET } from "@/game/terminal-traders/cards";
import { toTemplateCard } from "@/game/terminal-traders/templateCard";
import TradingCard from "@/components/TradingCard";

// The Genesis 80 binder (GENESIS.md roadmap): all 80 slots in edition order,
// owned cards lit with their rarity accent, unowned slots ghosted. Tapping a
// slot inspects the real holofoil TradingCard. Works in three modes:
//   - own binder, signed in  → owned counts from the collection
//   - own binder, signed out → full ghost + sign-in nudge
//   - public binder          → someone else's collection, read-only
// Collection data is server-authoritative (cardCollections via the API);
// this surface only ever reads.

const RARITY_ACCENT = {
  common: "#bfeede",
  uncommon: "#4dffaa",
  rare: "#8ee9ff",
  mythic: "#ff7ad9",
  "terminal-foil": "#ffd23a",
};

const SECTIONS = [
  { type: CARD_TYPES.TRADER, label: "TRADERS — THE CAST" },
  { type: CARD_TYPES.COIN, label: "COINS — SOLVED DOSSIERS" },
  { type: CARD_TYPES.ACTION, label: "ACTIONS — THE INVESTIGATIVE KIT" },
  { type: CARD_TYPES.MARKET, label: "MARKETS — DOCKET EVENTS" },
];

function subtitleFor(card) {
  if (card.type === CARD_TYPES.COIN) return `$${card.ticker}`;
  if (card.type === CARD_TYPES.TRADER) return card.handle;
  if (card.type === CARD_TYPES.MARKET) return "docket event";
  return card.kit?.role ? card.kit.role.replace(/([A-Z])/g, " $1").toLowerCase() : card.tag;
}

function InspectOverlay({ card, owned, count, onClose }) {
  const templateData = useMemo(() => toTemplateCard(card), [card]);
  const [scale, setScale] = useState(0.42);
  useEffect(() => {
    const adjust = () => {
      const byHeight = (window.innerHeight - 150) / 1038;
      const byWidth = Math.min(430, window.innerWidth * 0.9) / 744;
      setScale(Math.max(0.28, Math.min(0.56, byHeight, byWidth)));
    };
    adjust();
    window.addEventListener("resize", adjust);
    return () => window.removeEventListener("resize", adjust);
  }, []);
  return (
    <div className="gb-inspect" onClick={onClose}>
      <div className="gb-inspect-inner" onClick={(e) => e.stopPropagation()}>
        <div className={owned ? "" : "gb-inspect-ghost"}>
          <TradingCard data={templateData} scale={scale} />
        </div>
        <div className="gb-inspect-meta">
          {owned
            ? <span className="gb-owned-note">IN BINDER{count > 1 ? ` ×${count}` : ""}</span>
            : <span className="gb-ghost-note">NOT IN BINDER — earn it at the Case Table or pull it from a pack</span>}
          <button className="gb-close" onClick={onClose}>CLOSE ▸</button>
        </div>
      </div>
    </div>
  );
}

export default function GenesisBinder({ cards, loading, signedOut, publicView, ownerLabel, shareUrl, embedded = false, onExit }) {
  const [inspect, setInspect] = useState(null); // card id
  const [copied, setCopied] = useState(false);
  const owned = cards || {};
  const ownedDistinct = GENESIS_SET.filter((c) => owned[c.id] > 0).length;
  const ownedCopies = Object.values(owned).reduce((s, n) => s + n, 0);
  const inspectCard = inspect ? GENESIS_SET.find((c) => c.id === inspect) : null;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className={`gb-root${embedded ? " embedded" : ""}`}>
      <div className="gb-inner">
        <div className="gb-header">
          <div>
            {onExit && <button className="gb-exit" onClick={onExit}>◀ TERMINAL</button>}
            <div className="gb-eyebrow">▸ GENESIS 80 · {ownerLabel}</div>
            <div className="gb-title">The Binder</div>
          </div>
          <div className="gb-completion">
            <span className="gb-count">{ownedDistinct}<i>/ {GENESIS_SET.length}</i></span>
            <span className="gb-count-sub">{loading ? "COUNTING…" : `${ownedCopies} CARDS HELD`}</span>
            {shareUrl && !signedOut && (
              <button className="gb-share" onClick={copyShare}>{copied ? "LINK COPIED ✓" : "SHARE BINDER ▸"}</button>
            )}
          </div>
        </div>

        {signedOut && (
          <div className="gb-note">
            ◈ Sign in and the Terminal issues your starter collection — the browse below is the full
            Genesis 80, every slot waiting.
          </div>
        )}
        {publicView && (
          <div className="gb-note">◈ You are reading another analyst's binder. Every card here traces to a recorded grant.</div>
        )}

        {SECTIONS.map(({ type, label }) => {
          const sectionCards = GENESIS_SET.filter((c) => c.type === type);
          const sectionOwned = sectionCards.filter((c) => owned[c.id] > 0).length;
          return (
            <div key={type} className="gb-section">
              <div className="gb-section-head">
                <span className="gb-eyebrow">▸ {label}</span>
                <span className="gb-section-count">{sectionOwned} / {sectionCards.length}</span>
              </div>
              <div className="gb-grid">
                {sectionCards.map((card) => {
                  const count = owned[card.id] || 0;
                  const has = count > 0;
                  const edition = GENESIS_SET.findIndex((c) => c.id === card.id) + 1;
                  const accent = RARITY_ACCENT[card.rarity] || "#bfeede";
                  return (
                    <button
                      key={card.id}
                      className={`gb-slot ${has ? "owned" : "ghost"}${card.rarity === "terminal-foil" ? " foil" : ""}`}
                      style={{ "--cc": accent }}
                      onClick={() => setInspect(card.id)}
                    >
                      <span className="gb-slot-edition">{edition}/{GENESIS_SET.length}</span>
                      {count > 1 && <span className="gb-slot-count">×{count}</span>}
                      <span className="gb-slot-name">{card.name}</span>
                      <span className="gb-slot-sub">{subtitleFor(card)}</span>
                      <span className="gb-slot-rarity">{card.rarity.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {inspectCard && (
        <InspectOverlay
          card={inspectCard}
          owned={(owned[inspectCard.id] || 0) > 0}
          count={owned[inspectCard.id] || 0}
          onClose={() => setInspect(null)}
        />
      )}

      <style>{`
        .gb-root { min-height: 100vh; background: radial-gradient(120% 70% at 50% 0%, rgba(10,40,38,0.5), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; }
        .gb-root::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 5;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 3px); }
        .gb-root.embedded { position: absolute; inset: 0; min-height: 0; overflow-y: auto; }
        .gb-root.embedded::after { position: absolute; }
        .gb-exit { display: inline-block; margin-bottom: 8px; background: none; cursor: pointer;
          border: 1px solid rgba(47,214,214,0.4); color: #2fd6d6; font-family: 'Courier New', monospace;
          font-size: 10.5px; letter-spacing: 0.08em; padding: 6px 11px; }
        .gb-inner { max-width: 1100px; margin: 0 auto; padding: 26px 18px calc(env(safe-area-inset-bottom, 0px) + 40px);
          display: flex; flex-direction: column; gap: 20px; position: relative; z-index: 6; }
        .gb-eyebrow { font-size: 11px; letter-spacing: 0.14em; color: #ffd23a; }
        .gb-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .gb-title { font-size: 28px; font-weight: bold; color: #f4fffb; margin-top: 4px; letter-spacing: 0.02em; }
        .gb-completion { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .gb-count { font-size: 30px; font-weight: bold; color: #f4fffb; line-height: 1;
          text-shadow: 0 0 14px rgba(47,214,214,0.5); }
        .gb-count i { font-style: normal; font-size: 15px; color: #bfeede; opacity: 0.7; }
        .gb-count-sub { font-size: 9.5px; letter-spacing: 0.14em; color: #bfeede; opacity: 0.7; }
        .gb-share { margin-top: 5px; background: rgba(47,214,214,0.12); border: 1px solid #2fd6d6; color: #f4fffb;
          font: inherit; font-size: 10.5px; font-weight: bold; letter-spacing: 0.08em; padding: 7px 12px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
        .gb-note { border: 1px dashed rgba(255,210,58,0.5); background: rgba(16,13,2,0.85); color: #eafff9;
          font-size: 11.5px; line-height: 1.55; padding: 10px 13px; }
        .gb-section { display: flex; flex-direction: column; gap: 10px; }
        .gb-section-head { display: flex; justify-content: space-between; align-items: baseline; }
        .gb-section-count { font-size: 11px; color: #bfeede; opacity: 0.75; letter-spacing: 0.1em; }
        .gb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 9px; }
        .gb-slot { position: relative; aspect-ratio: 3 / 4; padding: 26px 9px 8px; text-align: left; cursor: pointer;
          display: flex; flex-direction: column; gap: 3px; justify-content: flex-end;
          font-family: inherit; color: #f4fffb;
          border: 1.5px solid color-mix(in srgb, var(--cc) 65%, transparent);
          background: linear-gradient(160deg, color-mix(in srgb, var(--cc) 14%, transparent), transparent 55%), #061a18;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: inset 0 0 18px color-mix(in srgb, var(--cc) 12%, transparent);
          transition: box-shadow 0.15s ease, transform 0.1s ease; }
        .gb-slot:hover { box-shadow: inset 0 0 24px color-mix(in srgb, var(--cc) 24%, transparent),
          0 0 12px color-mix(in srgb, var(--cc) 35%, transparent); }
        .gb-slot:active { transform: scale(0.98); }
        .gb-slot.owned.foil { animation: gbfoil 3.2s ease-in-out infinite; }
        @keyframes gbfoil { 50% { box-shadow: inset 0 0 26px color-mix(in srgb, var(--cc) 30%, transparent),
          0 0 16px color-mix(in srgb, var(--cc) 45%, transparent); } }
        .gb-slot.ghost { border-style: dashed; border-color: rgba(191,238,222,0.22); background: rgba(4,18,15,0.6);
          box-shadow: none; }
        .gb-slot.ghost .gb-slot-name, .gb-slot.ghost .gb-slot-sub, .gb-slot.ghost .gb-slot-rarity,
        .gb-slot.ghost .gb-slot-edition { opacity: 0.38; }
        .gb-slot-edition { position: absolute; top: 7px; left: 9px; font-size: 8.5px; letter-spacing: 0.1em;
          color: var(--cc); }
        .gb-slot-count { position: absolute; top: 6px; right: 8px; font-size: 9.5px; font-weight: bold; color: #02100e;
          background: var(--cc); padding: 2px 6px; clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px)); }
        .gb-slot-name { font-size: 12px; font-weight: bold; line-height: 1.25; }
        .gb-slot-sub { font-size: 9px; color: #bfeede; opacity: 0.8; letter-spacing: 0.04em; }
        .gb-slot-rarity { font-size: 7.5px; letter-spacing: 0.14em; color: var(--cc); }
        .gb-inspect { position: fixed; inset: 0; z-index: 10100; background: rgba(1,8,7,0.88);
          display: flex; align-items: center; justify-content: center; padding: 20px; }
        .gb-inspect-inner { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .gb-inspect-ghost { filter: grayscale(0.85) brightness(0.6); }
        .gb-inspect-meta { display: flex; align-items: center; gap: 14px; font-family: 'Courier New', monospace; }
        .gb-owned-note { color: #4dffaa; font-size: 11px; letter-spacing: 0.12em; font-weight: bold; }
        .gb-ghost-note { color: #bfeede; font-size: 10.5px; letter-spacing: 0.06em; opacity: 0.85; max-width: 320px; }
        .gb-close { background: rgba(47,214,214,0.12); border: 1px solid #2fd6d6; color: #f4fffb; font: inherit;
          font-size: 11px; font-weight: bold; letter-spacing: 0.08em; padding: 8px 14px; cursor: pointer;
          font-family: 'Courier New', monospace;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
      `}</style>
    </div>
  );
}
