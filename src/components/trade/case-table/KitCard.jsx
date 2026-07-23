// The kit hand, shared by the desk grid and the channel table dock (the
// kc-/kh- styles live in both surfaces' style blocks — import KC_CSS into
// each). Interaction model (playtest 2026-07-22): tap a card for the
// close-up — the real TradingCard, large — and PLAY from inside it. One
// model everywhere: tap to inspect, explicit button to act. (The old
// two-tap arm→play read as "nothing happens".)
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { KIT_CARDS, KIND_LABEL } from "@/game/terminal-traders/caseKit";
import { getCardById } from "@/game/terminal-traders/cards";
import { getCardArt, toTemplateCard } from "@/game/terminal-traders/templateCard";
import TradingCard from "@/components/TradingCard";
import { RARITY_COLOR } from "./constants";

// `art` (a CARD_ART src) renders as a backdrop behind the terminal text —
// the finished Genesis art showing through the kit card. Art-less cards
// keep the plain panel, so the run doesn't gate on artwork.
export function KitCard({ color, name, kind, text, footer, state = "idle", small, art, onClick }) {
  return (
    <button
      className={`kc-card ${state}${small ? " kc-small" : ""}`}
      style={{ "--cc": color }}
      onClick={onClick}
    >
      {art && <span className="kc-art" style={{ backgroundImage: `url(${art})` }} aria-hidden />}
      <span className="kc-name">{name}</span>
      <span className="kc-kind">{kind}</span>
      <span className="kc-text">{text}</span>
      <span className="kc-play">{footer}</span>
    </button>
  );
}

// The player's hand: Eugene's patron whisper (when unspent) + the dealt
// cards as real TradingCards. Tap a card → close-up overlay → PLAY (the
// button states the price: free action, overage bill, or book-too-thin).
// `overageCost` > 0 = the free budget is spent and the next play bills the
// book; `noActions` = the book can't fund another look.
export function KitHand({ cards = KIT_CARDS, small, kitPlayed, noActions, overageCost = 0, onPlay, showHint, onHint }) {
  const [viewId, setViewId] = useState(null);
  const [viewScale, setViewScale] = useState(0.52);
  const templates = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.id, toTemplateCard(getCardById(c.id))])),
    [cards]
  );
  useEffect(() => {
    if (!viewId) return;
    const fit = () => setViewScale(Math.min(
      (window.innerWidth - 48) / 744,
      (window.innerHeight - 210) / 1038,
      0.56
    ));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [viewId]);
  const scale = small ? 0.175 : 0.24;
  const view = cards.find((c) => c.id === viewId) || null;
  const viewPlayed = view ? kitPlayed.includes(view.id) : false;
  return (
    <>
      {showHint && (
        <KitCard
          small={small}
          color="#4dffaa"
          name="⟁ Déjà Vu"
          kind="PATRON · FREE"
          text={small
            ? "Eugene mutters where the crack lives."
            : "Eugene mutters where the crack lives — the case's decisive lenses. Costs nothing."}
          footer="WHISPER ▸"
          state="armed"
          onClick={onHint}
        />
      )}
      {cards.map((card) => {
        const played = kitPlayed.includes(card.id);
        return (
          <button
            key={card.id}
            className={`kh-thumb${played ? " kh-played" : ""}`}
            onClick={() => setViewId(card.id)}
            title={`${card.name} — tap for close-up`}
          >
            <TradingCard data={templates[card.id]} scale={scale} interactive={false} templateStyle="terminal" />
            {played && <span className="kh-badge">PLAYED</span>}
          </button>
        );
      })}
      {view && (
        <div className="kh-overlay" onClick={() => setViewId(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TradingCard data={templates[view.id]} scale={viewScale} templateStyle="terminal" />
          </div>
          <div className="kh-overlay-actions" onClick={(e) => e.stopPropagation()}>
            {viewPlayed ? (
              <span className="kh-note">ALREADY PLAYED THIS DEAL</span>
            ) : (
              <button
                className="kh-play"
                disabled={noActions}
                onClick={() => { onPlay(view); setViewId(null); }}
              >
                {noActions ? "BOOK TOO THIN" : overageCost > 0 ? `⟡ PLAY — BILLS −${overageCost} ▸` : "⟡ PLAY — 1 ACTION ▸"}
              </button>
            )}
            <button className="kh-close" onClick={() => setViewId(null)}>✕ CLOSE</button>
          </div>
        </div>
      )}
    </>
  );
}

// Shared kc- rules, embedded by both the desk and the dock style blocks.
export const KC_CSS = `
  .kc-card { position: relative; flex: 0 0 auto; width: 168px; aspect-ratio: 3 / 4; cursor: pointer;
    display: flex; flex-direction: column; gap: 6px; padding: 10px 10px 9px; text-align: left;
    border: 1.5px solid color-mix(in srgb, var(--cc) 65%, transparent);
    background: color-mix(in srgb, var(--cc) 7%, #04140f); color: #f4fffb; font-family: 'Courier New', monospace;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
    box-shadow: inset 0 0 18px color-mix(in srgb, var(--cc) 14%, transparent);
    transition: box-shadow 0.15s ease, transform 0.1s ease; }
  .kc-card:hover { box-shadow: inset 0 0 24px color-mix(in srgb, var(--cc) 26%, transparent),
    0 0 12px color-mix(in srgb, var(--cc) 40%, transparent); }
  .kc-card:active { transform: scale(0.98); }
  .kc-card.kc-small { width: 136px; padding: 8px 8px 7px; gap: 5px; }
  /* Genesis art backdrop: the upper band shows the art through a light
     scrim, fading to near-solid panel where the rules text and footer
     live. Text layers sit above it. */
  .kc-art { position: absolute; inset: 0; z-index: 0;
    background-size: cover; background-position: center 16%; }
  .kc-art::after { content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(4,20,15,0.42) 0%, rgba(4,20,15,0.84) 36%, rgba(4,20,15,0.97) 62%); }
  .kc-name, .kc-kind, .kc-text, .kc-play { position: relative; z-index: 1; }
  .kc-name { font-size: 12.5px; font-weight: bold; line-height: 1.25; text-shadow: 0 1px 3px rgba(0,0,0,0.85); }
  .kc-kind, .kc-text { text-shadow: 0 1px 2px rgba(0,0,0,0.7); }
  .kc-small .kc-name { font-size: 10.5px; }
  .kc-kind { font-size: 8px; letter-spacing: 0.12em; color: var(--cc); }
  .kc-text { font-size: 10.5px; line-height: 1.45; color: #bfeede; opacity: 0.85; flex: 1; overflow: hidden; }
  .kc-small .kc-text { font-size: 9.5px; line-height: 1.4; }
  .kc-play { font-size: 9.5px; font-weight: bold; letter-spacing: 0.06em; color: var(--cc); text-align: center;
    border: 1px solid color-mix(in srgb, var(--cc) 55%, transparent); padding: 6px 4px; opacity: 0.7; }
  .kc-small .kc-play { font-size: 8px; padding: 5px 3px; }
  .kc-card.armed { border-color: var(--cc); box-shadow: 0 0 14px color-mix(in srgb, var(--cc) 45%, transparent); }
  .kc-card.armed .kc-play { background: color-mix(in srgb, var(--cc) 18%, transparent); opacity: 1; }
  .kc-card.played { opacity: 0.35; cursor: default; }
  /* kh- : the hand as real TradingCards — tap for close-up, PLAY inside it. */
  .kh-thumb { position: relative; flex: 0 0 auto; background: none; border: none; padding: 2px;
    cursor: zoom-in; transition: transform 0.12s ease; }
  .kh-thumb:hover { transform: translateY(-3px); }
  .kh-thumb.kh-played { opacity: 0.4; }
  .kh-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-12deg);
    font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; letter-spacing: 0.2em;
    color: #ffd23a; border: 1.5px solid #ffd23a; padding: 3px 9px; background: rgba(4,20,15,0.85); }
  .kh-overlay { position: fixed; inset: 0; z-index: 10060; display: flex; flex-direction: column;
    gap: 13px; align-items: center; justify-content: center;
    background: rgba(2,10,9,0.9); backdrop-filter: blur(4px); }
  .kh-overlay-actions { display: flex; gap: 10px; align-items: center; }
  .kh-play { background: rgba(47,214,214,0.14); border: 1.5px solid #2fd6d6; color: #f4fffb;
    font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; letter-spacing: 0.08em;
    padding: 12px 22px; cursor: pointer;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    box-shadow: 0 0 14px rgba(47,214,214,0.3); }
  .kh-play:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
  .kh-close { background: none; border: 1px solid rgba(47,214,214,0.4); color: #2fd6d6;
    font-family: 'Courier New', monospace; font-size: 11.5px; letter-spacing: 0.06em;
    padding: 11px 16px; cursor: pointer; }
  .kh-note { font-family: 'Courier New', monospace; font-size: 11.5px; font-weight: bold;
    letter-spacing: 0.14em; color: #ffd23a; }
`;
