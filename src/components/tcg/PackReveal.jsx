"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getCardById } from "@/game/terminal-traders/cards";
import { toTemplateCard } from "@/game/terminal-traders/templateCard";
import { PACK_SIZE, STANDARD_SLOT, BONUS_SLOT } from "@/game/terminal-traders/packs";
import TradingCard from "@/components/TradingCard";

// "CHAIN OF CUSTODY" — the pack-reveal moment (GENESIS.md roadmap). A pack
// is a sealed evidence envelope from the house: tear the strip, flip five
// case-file cards one at a time (edge-glow telegraphs rarity before the
// flip), the desk stops for mythics and foils, everything files to the
// binder. Pure theater over known contents — the grant already happened
// server-side; this component just takes the card ids. The dossier coin
// gets its own smaller beat: a CASE CLOSED stamp. All CSS, no art assets —
// finished art drops into the TradingCard template with no rework here.
//
// Props: pack (cardId[5] or []), coin (cardId or null), onClose().
// With an empty pack (completion-only day) it opens straight on the coin.

const RARITY_GLOW = {
  common: "#2fd6d6",
  uncommon: "#4dffaa",
  rare: "#8ee9ff",
  mythic: "#ff7ad9",
  "terminal-foil": "#ffd23a",
};
const BIG_PULL = new Set(["mythic", "terminal-foil"]);

function OddsTable({ onClose }) {
  const pct = (row, table) => `${(row.weight / table.reduce((s, r) => s + r.weight, 0) * 100).toFixed(1)}%`;
  return (
    <div className="pr-odds" onClick={(e) => e.stopPropagation()}>
      <div className="pr-odds-title">◈ THE HOUSE POSTS ITS ODDS</div>
      <div className="pr-odds-grid">
        <div className="pr-odds-col">
          <b>SLOTS 1–4</b>
          {STANDARD_SLOT.map((r) => <span key={r.rarity}>{r.rarity.toUpperCase()} — {pct(r, STANDARD_SLOT)}</span>)}
        </div>
        <div className="pr-odds-col">
          <b>SLOT 5 · BONUS</b>
          {BONUS_SLOT.map((r) => <span key={r.rarity}>{r.rarity.toUpperCase()} — {pct(r, BONUS_SLOT)}</span>)}
        </div>
      </div>
      <button className="pr-ghost" onClick={onClose}>CLOSE ▸</button>
    </div>
  );
}

export default function PackReveal({ pack = [], coin = null, onClose }) {
  const cards = useMemo(() => pack.map((id) => getCardById(id)).filter(Boolean), [pack]);
  const [stage, setStage] = useState(cards.length ? "sealed" : "filed"); // sealed | tearing | cards | filed
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [deskStops, setDeskStops] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [stamped, setStamped] = useState(false);
  const [scale, setScale] = useState(0.4);

  const current = cards[idx];
  const coinCard = coin ? getCardById(coin) : null;
  const currentTemplate = useMemo(() => (current ? toTemplateCard(current) : null), [current]);
  const isDupe = current && cards.slice(0, idx).some((c) => c.id === current.id);

  useEffect(() => {
    const adjust = () => {
      const byHeight = (window.innerHeight - 210) / 1038;
      const byWidth = Math.min(400, window.innerWidth * 0.82) / 744;
      setScale(Math.max(0.24, Math.min(0.5, byHeight, byWidth)));
    };
    adjust();
    window.addEventListener("resize", adjust);
    return () => window.removeEventListener("resize", adjust);
  }, []);

  // the CASE CLOSED stamp slams shortly after the filing screen appears
  useEffect(() => {
    if (stage !== "filed" || !coinCard) return;
    const t = setTimeout(() => setStamped(true), 450);
    return () => clearTimeout(t);
  }, [stage, coinCard]);

  const tear = () => {
    setStage("tearing");
    setTimeout(() => setStage("cards"), 650);
  };

  const flip = () => {
    if (flipped) return;
    setFlipped(true);
    if (BIG_PULL.has(current.rarity)) {
      setDeskStops(true);
      setTimeout(() => setDeskStops(false), 1600);
    }
  };

  const fileCard = () => {
    if (idx + 1 >= cards.length) { setStage("filed"); return; }
    setIdx(idx + 1);
    setFlipped(false);
  };

  const glow = current ? RARITY_GLOW[current.rarity] || "#2fd6d6" : "#2fd6d6";
  const backW = Math.round(744 * scale);
  const backH = Math.round(1038 * scale);

  return (
    <div className={`pr-root${deskStops ? " desk-stops" : ""}`}>
      {stage === "sealed" || stage === "tearing" ? (
        <div className="pr-stage">
          <div className={`pr-envelope${stage === "tearing" ? " torn" : ""}`} onClick={stage === "sealed" ? tear : undefined}>
            <div className="pr-env-flap" />
            <div className="pr-env-sigil">◈</div>
            <div className="pr-env-title">SEALED GENESIS PACK</div>
            <div className="pr-env-custody">CHAIN OF CUSTODY<br />THE HOUSE → YOU</div>
            <div className="pr-env-strip"><span>EVIDENCE · EVIDENCE · EVIDENCE · EVIDENCE</span></div>
          </div>
          {stage === "sealed" && (
            <>
              <button className="pr-cta" onClick={tear}>TEAR THE SEAL ▸</button>
              <div className="pr-subrow">
                <button className="pr-ghost" onClick={() => setStage("filed")}>FILE ALL ▸</button>
                <button className="pr-ghost" onClick={() => setShowOdds(true)}>published odds ▸</button>
              </div>
            </>
          )}
          {showOdds && <OddsTable onClose={() => setShowOdds(false)} />}
        </div>
      ) : stage === "cards" ? (
        <div className="pr-stage">
          <div className="pr-progress">CARD {idx + 1} / {cards.length}{idx === cards.length - 1 ? " · BONUS SLOT" : ""}</div>
          <div className={`pr-flip${flipped ? " is-flipped" : ""}`} style={{ "--cc": glow, width: backW, height: backH }} onClick={flip}>
            <div className="pr-face pr-back" style={{ width: backW, height: backH }}>
              <span className="pr-back-sigil">◈</span>
              <span className="pr-back-word">GENESIS</span>
            </div>
            <div className="pr-face pr-front">
              {flipped && currentTemplate && <TradingCard data={currentTemplate} scale={scale} />}
            </div>
          </div>
          {flipped ? (
            <>
              {isDupe && <div className="pr-dupe">DUPLICATE — CRAFT LATER</div>}
              <button className="pr-cta" onClick={fileCard}>{idx + 1 >= cards.length ? "FILE THE LAST ▸" : "FILE IT ▸"}</button>
            </>
          ) : (
            <div className="pr-hint">TAP TO FLIP — the glow knows something you don't.</div>
          )}
          <div className="pr-rail">
            {cards.map((c, i) => (
              <span key={i} className={`pr-mini${i < idx || (i === idx && flipped) ? " shown" : ""}`}
                style={{ "--cc": i < idx || (i === idx && flipped) ? (RARITY_GLOW[c.rarity] || "#2fd6d6") : "#1c3a36" }}>
                {i < idx || (i === idx && flipped) ? c.name : "◈"}
              </span>
            ))}
          </div>
          <button className="pr-ghost pr-skip" onClick={() => setStage("filed")}>FILE ALL ▸</button>
        </div>
      ) : (
        <div className="pr-stage">
          <div className="pr-progress">{cards.length ? "EVIDENCE FILED" : "CASE CLOSED"}</div>
          {cards.length > 0 && (
            <div className="pr-summary">
              {cards.map((c, i) => (
                <span key={`${c.id}-${i}`} className="pr-chip" style={{ "--cc": RARITY_GLOW[c.rarity] || "#2fd6d6" }}>
                  {c.name}<i>{c.rarity.toUpperCase()}</i>
                </span>
              ))}
            </div>
          )}
          {coinCard && (
            <div className="pr-coin">
              <span className="pr-chip pr-coin-chip" style={{ "--cc": RARITY_GLOW[coinCard.rarity] || "#2fd6d6" }}>
                {coinCard.name}<i>THE DAY'S DOSSIER COIN · {coinCard.rarity.toUpperCase()}</i>
              </span>
              <span className={`pr-stamp${stamped ? " slam" : ""}`}>CASE CLOSED</span>
            </div>
          )}
          <div className="pr-subrow">
            <a className="pr-cta" href="/binder">FILED TO BINDER ▸</a>
            <button className="pr-ghost" onClick={onClose}>DONE ▸</button>
          </div>
        </div>
      )}

      {deskStops && <div className="pr-desk-banner">THE DESK STOPS.</div>}

      <style>{`
        .pr-root { position: fixed; inset: 0; z-index: 10120; background: rgba(1,8,7,0.94);
          display: flex; align-items: center; justify-content: center;
          color: #2fd6d6; font-family: 'Courier New', monospace; }
        .pr-root::after { content: ""; position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px); }
        .pr-root.desk-stops { animation: prflicker 0.14s steps(2) 6; }
        @keyframes prflicker { 50% { filter: brightness(1.7) contrast(1.3); } }
        .pr-stage { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center;
          gap: 14px; padding: 20px; max-width: 92vw; }
        .pr-progress { font-size: 11px; letter-spacing: 0.16em; color: #ffd23a; }
        .pr-envelope { position: relative; width: min(340px, 80vw); aspect-ratio: 4 / 3; cursor: pointer;
          background: linear-gradient(165deg, #123430, #081d1a 70%);
          border: 1.5px solid rgba(255,210,58,0.55);
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
          box-shadow: inset 0 0 30px rgba(255,210,58,0.08), 0 0 30px rgba(47,214,214,0.12);
          transition: transform 0.5s ease, opacity 0.5s ease; }
        .pr-envelope.torn { transform: scale(1.06) rotate(-1.5deg); opacity: 0; }
        .pr-env-flap { position: absolute; top: 0; left: 0; right: 0; height: 34%;
          background: linear-gradient(180deg, rgba(255,210,58,0.09), transparent);
          clip-path: polygon(0 0, 100% 0, 50% 100%); pointer-events: none; }
        .pr-env-sigil { font-size: 40px; color: #ffd23a; text-shadow: 0 0 18px rgba(255,210,58,0.6); }
        .pr-env-title { font-size: 14px; font-weight: bold; letter-spacing: 0.18em; color: #f4fffb; }
        .pr-env-custody { font-size: 9px; letter-spacing: 0.2em; text-align: center; color: #bfeede; opacity: 0.8; line-height: 1.7; }
        .pr-env-strip { position: absolute; bottom: 18%; left: -4px; right: -4px; overflow: hidden;
          background: rgba(255,210,58,0.14); border-top: 1px dashed #ffd23a; border-bottom: 1px dashed #ffd23a;
          transform: rotate(-2deg); }
        .pr-env-strip span { display: block; white-space: nowrap; font-size: 9px; letter-spacing: 0.3em;
          color: #ffd23a; padding: 4px 0; animation: prstrip 9s linear infinite; }
        @keyframes prstrip { to { transform: translateX(-33%); } }
        .pr-flip { position: relative; cursor: pointer; transform-style: preserve-3d;
          transition: transform 0.55s cubic-bezier(0.3, 1.2, 0.4, 1); }
        .pr-flip.is-flipped { transform: rotateY(180deg); cursor: default; }
        .pr-face { position: absolute; inset: 0; backface-visibility: hidden; }
        .pr-front { transform: rotateY(180deg); display: flex; align-items: flex-start; justify-content: center; }
        .pr-back { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(160deg, #0a221f, #050f0d 75%);
          border: 2px solid color-mix(in srgb, var(--cc) 75%, transparent); border-radius: 14px;
          box-shadow: 0 0 26px color-mix(in srgb, var(--cc) 45%, transparent),
            inset 0 0 40px color-mix(in srgb, var(--cc) 14%, transparent);
          animation: prpulse 1.6s ease-in-out infinite; }
        @keyframes prpulse { 50% { box-shadow: 0 0 40px color-mix(in srgb, var(--cc) 65%, transparent),
          inset 0 0 46px color-mix(in srgb, var(--cc) 20%, transparent); } }
        .pr-back-sigil { font-size: 54px; color: var(--cc); text-shadow: 0 0 22px color-mix(in srgb, var(--cc) 70%, transparent); }
        .pr-back-word { font-size: 11px; letter-spacing: 0.5em; color: #bfeede; opacity: 0.7; }
        .pr-hint { font-size: 10.5px; color: #bfeede; opacity: 0.75; letter-spacing: 0.06em; }
        .pr-dupe { font-size: 9.5px; letter-spacing: 0.16em; color: #ffd23a; border: 1px dashed rgba(255,210,58,0.5); padding: 4px 9px; }
        .pr-cta { background: rgba(47,214,214,0.12); border: 1.5px solid #2fd6d6; color: #f4fffb; font: inherit;
          font-weight: bold; letter-spacing: 0.08em; font-size: 13px; padding: 12px 22px; cursor: pointer;
          text-decoration: none; font-family: 'Courier New', monospace;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
          box-shadow: 0 0 12px rgba(47,214,214,0.25); }
        .pr-ghost { background: none; border: 1px solid rgba(47,214,214,0.4); color: #2fd6d6; font: inherit;
          font-size: 10.5px; letter-spacing: 0.06em; padding: 8px 13px; cursor: pointer; font-family: 'Courier New', monospace; }
        .pr-subrow { display: flex; gap: 10px; align-items: center; }
        .pr-skip { position: absolute; top: 14px; right: 14px; }
        .pr-rail { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; max-width: 90vw; }
        .pr-mini { font-size: 8.5px; letter-spacing: 0.08em; color: #bfeede; opacity: 0.5; padding: 4px 7px;
          border: 1px solid color-mix(in srgb, var(--cc) 55%, transparent); }
        .pr-mini.shown { opacity: 1; color: #f4fffb; background: color-mix(in srgb, var(--cc) 10%, transparent); }
        .pr-summary { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 480px; }
        .pr-chip { display: inline-flex; flex-direction: column; gap: 2px; padding: 8px 11px; color: #f4fffb;
          font-size: 11.5px; font-weight: bold;
          border: 1px solid color-mix(in srgb, var(--cc) 60%, transparent);
          background: color-mix(in srgb, var(--cc) 9%, transparent);
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
        .pr-chip i { font-style: normal; font-weight: normal; font-size: 8px; letter-spacing: 0.12em; color: var(--cc); }
        .pr-coin { position: relative; margin-top: 6px; }
        .pr-coin-chip { border-width: 2px; box-shadow: 0 0 14px color-mix(in srgb, var(--cc) 35%, transparent); }
        .pr-stamp { position: absolute; top: -12px; right: -26px; transform: rotate(-14deg) scale(3); opacity: 0;
          font-size: 15px; font-weight: bold; letter-spacing: 0.14em; color: #ff5454;
          border: 3px solid #ff5454; border-radius: 4px; padding: 3px 8px; pointer-events: none; }
        .pr-stamp.slam { animation: prslam 0.35s cubic-bezier(0.2, 1.6, 0.4, 1) forwards; }
        @keyframes prslam { to { opacity: 0.92; transform: rotate(-14deg) scale(1); } }
        .pr-desk-banner { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center;
          pointer-events: none; font-size: clamp(22px, 5vw, 44px); font-weight: bold; letter-spacing: 0.22em; color: #ffd23a;
          text-shadow: 0 0 30px rgba(255,210,58,0.8); background: radial-gradient(60% 40% at 50% 50%, rgba(1,8,7,0.85), transparent);
          animation: prbanner 1.6s ease forwards; }
        @keyframes prbanner { 0% { opacity: 0; transform: scale(1.25); } 18% { opacity: 1; transform: scale(1); }
          80% { opacity: 1; } 100% { opacity: 0; } }
        .pr-odds { position: absolute; z-index: 4; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: #04140f; border: 1px solid rgba(255,210,58,0.5); padding: 16px; display: flex;
          flex-direction: column; gap: 10px; align-items: center; }
        .pr-odds-title { font-size: 10.5px; letter-spacing: 0.16em; color: #ffd23a; font-weight: bold; }
        .pr-odds-grid { display: flex; gap: 22px; }
        .pr-odds-col { display: flex; flex-direction: column; gap: 4px; font-size: 10px; color: #eafff9; }
        .pr-odds-col b { color: #2fd6d6; letter-spacing: 0.1em; margin-bottom: 2px; }
      `}</style>
    </div>
  );
}
