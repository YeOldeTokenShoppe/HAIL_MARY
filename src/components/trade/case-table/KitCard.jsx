// Card-shaped kit card + the kit hand row, shared by the desk grid and the
// channel table dock (the kc- styles live in both surfaces' style blocks —
// import KC_CSS into each). Two-tap flow: arm → play.
import React from "react";
import { KIT_CARDS, KIND_LABEL } from "@/game/terminal-traders/caseKit";
import { getCardArt } from "@/game/terminal-traders/templateCard";
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

// The player's hand: Eugene's patron whisper (when unspent) + the kit cards.
// Owns the two-tap arm/play interaction; effects resolve upstream (caseKit).
// `cards` is the confirmed kit (KitSelect); the full First Twelve is only
// the pre-kit dev fallback.
export function KitHand({ cards = KIT_CARDS, small, kitPlayed, selectedCard, noActions, onArm, onPlay, showHint, onHint }) {
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
        const sel = selectedCard === card.id;
        return (
          <KitCard
            key={card.id}
            small={small}
            color={RARITY_COLOR[card.rarity]}
            name={card.name}
            kind={`${card.rarity.toUpperCase()} · ${KIND_LABEL[card.kind]}`}
            text={card.text}
            art={getCardArt(card.id)}
            state={played ? "played" : sel ? "armed" : "idle"}
            footer={played ? "PLAYED" : !sel ? "TAP TO ARM" : noActions ? "NO ACTIONS LEFT" : small ? "TAP AGAIN — 1 ACT ▸" : "TAP AGAIN — 1 ACTION ▸"}
            onClick={() => {
              if (played) return;
              if (!sel) { onArm(card.id); return; }
              if (!noActions) onPlay(card);
            }}
          />
        );
      })}
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
`;
