"use client";

import React, { useCallback, useState } from "react";
import RcanaCard from "./RcanaCard";
import { RCANA_CARD_BACK } from "../game/rcana/cardFace.js";

// An R-cana card with a back. The front is the ordinary RcanaCard; the back
// is the lotería poster (RCANA_CARD_BACK). Click, Enter or Space turns it
// over; `flipped` makes it controlled.
//
// The front face is `transform-style: flat` with its backface hidden. Flat
// does not cost the parallax: the card's own 3D context (perspective on
// .rc-stage, preserve-3d on .rc-card) still renders its depth, and is then
// painted into the face as one plane — which is exactly what lets a single
// backface-visibility hide the whole stack while the flipper is turned. With
// preserve-3d on the face instead, every tilted layer would resolve its own
// backface and leak through the back mid-turn. (Same recipe as the reliquary
// flipper around TradingCard.)
export default function RcanaFlipCard({
  flipped: flippedProp,
  defaultFlipped = false,
  onFlip,
  back = RCANA_CARD_BACK,
  // Click/keyboard turns the card. Off when the caller wants click for
  // something else and drives `flipped` itself.
  flipOnClick = true,
  interactive = true,
  // Flip perspective in px. Wider flattens the turn so the card's near edge
  // swells less — for a host with little room around the card.
  perspective = 1400,
  className,
  ...cardProps
}) {
  const controlled = flippedProp != null;
  const [own, setOwn] = useState(defaultFlipped);
  const flipped = controlled ? !!flippedProp : own;

  const toggle = useCallback(() => {
    const next = !flipped;
    if (!controlled) setOwn(next);
    onFlip?.(next);
  }, [flipped, controlled, onFlip]);

  const onKeyDown = (e) => {
    if (!flipOnClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className={`rcf${className ? ` ${className}` : ""}`} style={{ "--rcf-p": `${perspective}px` }}>
      <div
        className="rcf-flipper"
        data-flipped={flipped || undefined}
        data-clickable={flipOnClick || undefined}
        role={flipOnClick ? "button" : undefined}
        tabIndex={flipOnClick ? 0 : undefined}
        aria-pressed={flipOnClick ? flipped : undefined}
        aria-label={flipOnClick ? (flipped ? "Show the card's face" : "Show the card's back") : undefined}
        onClick={flipOnClick ? toggle : undefined}
        onKeyDown={onKeyDown}
      >
        <div className="rcf-face rcf-face--front" aria-hidden={flipped || undefined}>
          {/* A turned card is not tilting under a pointer nobody can see it follow. */}
          <RcanaCard {...cardProps} interactive={interactive && !flipped} />
        </div>
        <div className="rcf-face rcf-face--back" aria-hidden={!flipped || undefined}>
          <img src={back} alt="" draggable={false} decoding="async" />
        </div>
      </div>
      <style>{RCF_STYLES}</style>
    </div>
  );
}

const RCF_STYLES = `
.rcf {
  display: inline-block;
  /* Perspective on the flipper's parent, so its rotateY reads as depth. The
     card's own .rc-stage perspective inside still drives its tilt. */
  perspective: var(--rcf-p, 1400px);
  perspective-origin: 50% 40%;
}
.rcf-flipper {
  position: relative;
  display: inline-block;
  transform-style: preserve-3d;
  transform: rotateY(0deg);
  transition: transform 620ms cubic-bezier(.55,.05,.3,1);
  outline: none;
}
.rcf-flipper[data-flipped] { transform: rotateY(180deg); }
.rcf-flipper[data-clickable] { cursor: pointer; }
.rcf-flipper:focus-visible {
  box-shadow: 0 0 0 2px rgba(241, 215, 122, .7);
  border-radius: 12px;
}
.rcf-face {
  transform-style: flat;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.rcf-face--front {
  position: relative;
  /* inline-block so the flipper sizes to the card's .rc-stage width; the
     back then matches it through inset: 0. */
  display: inline-block;
  vertical-align: top;
}
.rcf-face--back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
  /* The frame's own corner radius (see .rc-gloss), so the back's corners
     sit where the face's do. */
  border-radius: 3.6%;
  overflow: hidden;
  background: #1c1232;
  box-shadow:
    0 28px 60px rgba(0, 0, 0, .55),
    0 0 0 1px rgba(255, 255, 255, .04),
    0 0 60px rgba(241, 215, 122, .18);
}
.rcf-face--back img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
@media (prefers-reduced-motion: reduce) {
  .rcf-flipper { transition: none; }
}
`;
