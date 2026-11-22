"use client";

import React, { useCallback, useRef, useState } from "react";
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
// Bump the ?v= when the mask is repainted, so browsers drop the old one.
export const RCANA_BACK_GOLD_MASK = "/TCG/rcana/cardBack-gold-mask.webp?v=3";

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
  // The component drawn on the front. RcanaCard by default; RcanaCard3 for the
  // code-drawn frame, with `backRadius` set to that frame's corner ("4.7%").
  Front = RcanaCard,
  backRadius,
  // Mirror gold on the back's four coins and its RL80, to match a mirror-gold
  // face. `true` uses the mask made for the lotería back (white where the gold
  // goes, clear elsewhere); a string is another mask for another back. The
  // turned card then leans and shimmers under the pointer like the face does.
  backFoil = false,
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

  const backRef = useRef(null);
  const foilMask = backFoil === true ? RCANA_BACK_GOLD_MASK : backFoil || null;
  const lean = (e) => {
    const el = backRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const py = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    el.style.setProperty("--rx", `${((0.5 - py) * 20).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((px - 0.5) * 20).toFixed(2)}deg`);
    el.style.setProperty("--ease", "60ms");
  };
  const settle = () => {
    const el = backRef.current;
    if (!el) return;
    el.style.setProperty("--ease", "500ms");
    for (const v of ["--mx", "--my", "--rx", "--ry"]) el.style.removeProperty(v);
  };
  const tracksBack = !!foilMask && interactive && flipped;

  const onKeyDown = (e) => {
    if (!flipOnClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className={`rcf${className ? ` ${className}` : ""}`} style={{ touchAction: interactive && !flipped ? "none" : undefined, "--rcf-p": `${perspective}px`, ...(backRadius ? { "--rcf-r": backRadius } : null) }}>
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
          <Front {...cardProps} interactive={interactive && !flipped} />
        </div>
        <div
          ref={backRef}
          className="rcf-face rcf-face--back"
          data-foil={foilMask ? "" : undefined}
          aria-hidden={!flipped || undefined}
          onPointerMove={tracksBack ? lean : undefined}
          onPointerLeave={tracksBack ? settle : undefined}
          onPointerCancel={tracksBack ? settle : undefined}
        >
          <img src={back} alt="" draggable={false} decoding="async" />
          {foilMask && (
            <div className="rcf-back-foil" aria-hidden="true" style={{ WebkitMaskImage: `url("${foilMask}")`, maskImage: `url("${foilMask}")` }}>
              <div className="rcf-back-foil-gold" />
              <div className="rcf-back-foil-glare" />
            </div>
          )}
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
  border-radius: var(--rcf-r, 3.6%);
  overflow: hidden;
  background: #1c1232;
  box-shadow:
    0 28px 60px rgba(0, 0, 0, .55),
    0 0 0 1px rgba(255, 255, 255, .04),
    0 0 60px rgba(241, 215, 122, .18);
}
/* A foiled back leans under the pointer once turned (its own rotateY(180deg) first). */
.rcf-face--back[data-foil] {
  transform: rotateY(180deg) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform var(--ease, 500ms) ease-out;
}
.rcf-back-foil {
  position: absolute; inset: 0; pointer-events: none;
  -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
}
.rcf-back-foil-gold, .rcf-back-foil-glare { position: absolute; inset: 0; }
/* The same bands and glare as RcanaCard3's mirror metal. */
.rcf-back-foil-gold {
  background-image: repeating-linear-gradient(calc(118deg + var(--ry, 0deg) * 1.6), #bd8600 0%, #d39a00 7%, #f2b705 13%, #fff6c4 19%, #ffd84a 25%, #d9a300 36%, #c69000 44%, #ffe58a 55%, #fffbe0 59%, #f2b705 68%, #bd8600 100%);
  background-size: 320% 320%;
  background-position: calc(50% + (50% - var(--mx, 50%)) * 1.5) calc(50% + (50% - var(--my, 50%)) * 1.5);
  transition: background-position var(--ease, 500ms) ease-out;
}
.rcf-back-foil-glare {
  mix-blend-mode: screen;
  background-image: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,.95) 0%, rgba(255,246,196,.5) 16%, rgba(255,255,255,0) 42%);
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
