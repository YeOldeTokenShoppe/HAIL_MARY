"use client";

import React, { useCallback, useEffect, useState } from "react";
import RcanaFlipCard from "./RcanaFlipCard";
import { RCANA_ASPECT } from "../game/rcana/cardFace.js";

// The R-cana card viewer: one live card picked up out of the binder, over a
// dimmed page. Tilt follows the pointer, a click turns it over, the arrows
// (and ← →) walk the binder in order, Escape or the backdrop puts it back.
//
// `cards` is the binder's order — [{ id, name, number, rarity, card }] with
// `card` already through toRcanaCard — and `id` the one held up. The viewer
// keeps no selection of its own: the page owns it, so a deep link can open
// straight onto a card and the URL can follow the arrows.
const CARD_W = 744;
const MAX_SCALE = 0.92;

function useFitScale(open) {
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    if (!open) return undefined;
    const fit = () => {
      // Room for the caption below and the arrows beside the card.
      const w = (window.innerWidth - (window.innerWidth < 720 ? 32 : 150)) / CARD_W;
      const h = (window.innerHeight - 150) / (CARD_W / RCANA_ASPECT);
      setScale(Math.max(0.3, Math.min(MAX_SCALE, w, h)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);
  return scale;
}

export default function RcanaViewer({ cards, id, onChange, onClose, onBench = null }) {
  const index = cards.findIndex((c) => c.id === id);
  const open = index >= 0;
  const entry = open ? cards[index] : null;
  const scale = useFitScale(open);
  const [flipped, setFlipped] = useState(false);

  const step = useCallback((d) => {
    if (!open) return;
    const next = cards[(index + d + cards.length) % cards.length];
    setFlipped(false);
    onChange(next.id);
  }, [open, cards, index, onChange]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under the card.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, step, onClose]);

  // A fresh card is always shown face up.
  useEffect(() => { setFlipped(false); }, [id]);

  if (!open) return null;
  const { card } = entry;
  const sub = [
    entry.number != null ? `No. ${entry.number}` : null,
    entry.rarity,
    card.subClass ? `${card.subClass} ${card.cardClass}` : card.cardClass,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className="rcv"
      role="dialog"
      aria-modal="true"
      aria-label={entry.name}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button className="rcv-x" type="button" aria-label="Put the card back" onClick={onClose}>×</button>

      <button className="rcv-arrow rcv-arrow--prev" type="button" aria-label="Previous card" onClick={() => step(-1)}>‹</button>

      <div className="rcv-stage">
        <RcanaFlipCard
          key={entry.id}
          data={card}
          scale={scale}
          depth={1}
          interactive
          showFx
          sway
          captureTouch
          flipped={flipped}
          onFlip={setFlipped}
        />
        <p className="rcv-cap">
          <b>{entry.name}</b>
          {entry.gloss && <i className="rcv-gloss">{entry.gloss}</i>}
          <small>{sub} · {index + 1} of {cards.length}</small>
          <span className="rcv-hint">tilt it · click to turn it over · ← → to browse</span>
          {onBench && (
            <button type="button" className="rcv-bench" onClick={() => onBench(entry.id)}>open on the bench</button>
          )}
        </p>
      </div>

      <button className="rcv-arrow rcv-arrow--next" type="button" aria-label="Next card" onClick={() => step(1)}>›</button>

      <style>{RCV_STYLES}</style>
    </div>
  );
}

const RCV_STYLES = `
.rcv {
  position: fixed; inset: 0; z-index: 80;
  display: grid; grid-template-columns: 64px 1fr 64px; align-items: center;
  background: rgba(3, 6, 12, .88);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  animation: rcvIn 180ms ease-out;
}
@keyframes rcvIn { from { opacity: 0; } to { opacity: 1; } }
.rcv-stage {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  justify-self: center;
  animation: rcvLift 260ms cubic-bezier(.2,.7,.3,1);
}
@keyframes rcvLift { from { transform: translateY(18px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }
.rcv-cap { margin: 0; text-align: center; color: #effff9; display: flex; flex-direction: column; gap: 3px; }
.rcv-cap b { font-family: "Bebas Neue", Impact, sans-serif; font-weight: 400; font-size: 26px; letter-spacing: .04em; color: #fff7ce; }
.rcv-gloss { font-style: italic; font-size: 15px; color: rgba(239,255,249,.78); margin-top: -2px; }
.rcv-cap small { font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #53ffd6; }
.rcv-hint { font-size: 12px; color: rgba(239,255,249,.5); }
.rcv-bench {
  margin: 6px auto 0; padding: 5px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(255,209,102,.4); background: rgba(255,209,102,.08); color: #ffd166;
  font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
}
.rcv-arrow, .rcv-x {
  width: 46px; height: 46px; border-radius: 50%; cursor: pointer;
  border: 1px solid rgba(255,255,255,.18); background: rgba(0,0,0,.5); color: #effff9;
  font: 400 30px/1 "IBM Plex Mono", monospace; display: grid; place-items: center;
  transition: border-color 160ms ease, color 160ms ease;
}
.rcv-arrow:hover, .rcv-x:hover { border-color: #53ffd6; color: #53ffd6; }
.rcv-arrow { justify-self: center; padding-bottom: 4px; }
.rcv-x { position: fixed; top: 16px; right: 18px; font-size: 26px; }
@media (max-width: 719px) {
  .rcv { grid-template-columns: 1fr; }
  .rcv-arrow { position: fixed; bottom: 18px; }
  .rcv-arrow--prev { left: 18px; }
  .rcv-arrow--next { right: 18px; }
  .rcv-cap b { font-size: 22px; }
  .rcv-hint { display: none; }
}
`;
