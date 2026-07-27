"use client";
import React from "react";
import gsap from "gsap";
import { playSfx } from "@/lib/uiSfx";

// THE DEAL — shared by both presentations of the VC game.
//
// The five opening cards used to materialise with a CSS stagger the moment the
// panel appeared, which read as "the page finished loading" rather than "you
// were dealt a hand". Now the table starts empty and YOU deal it.
//
// The flight is a hand-rolled FLIP: every card stays in its real DOM slot — so
// the layout stays authoritative and responsive — and we animate the measured
// DELTA from the deck stub to that slot. Nothing is absolutely positioned into
// place, nothing reflows, and it is pure transform/opacity, which matters
// because on desktop this plays over the LIVE temple scene.
//
// This file is PRESENTATION ONLY, like the two components that use it. It owns
// no rule and never touches the run — dealing is choreography over a hand that
// pressRun.js already decided.

export const CARD_W = 744, CARD_H = 1038;   // TradingCard's native box, pre --scale

const STAGGER = 0.16;   // gap between cards leaving the deck
const FLIGHT  = 0.66;   // deck -> slot
const FLIP_AT = 0.30;   // into the flight, when it starts turning face-up
const FLIP_DUR = 0.46;

export const SFX = {
  deal: "/audio/card_flip.mp3",       // per card, as it comes off the deck
  // Optional deck riffle under the button press. playSfx no-ops safely on a
  // missing file (uiSfx caches the failed fetch and the element fallback
  // swallows the rest), so this lights up by itself once a file lands here.
  shuffle: "/audio/card_shuffle.mp3",
};
// Measured, not guessed: card_flip.mp3 is -26.1 LUFS, ~2dB under
// /audio/proceed.mp3, which CyberButton plays at 1.0 — so a single hit would
// sit near 1.0. But this fires five times inside 1.3s, so it opens at 0.8 and
// eases down across the deal: the hand settles instead of machine-gunning.
const DEAL_VOL = 0.8, DEAL_DECAY = 0.07;

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/**
 * One dealt card. The slot is a fixed, static box that holds the layout open
 * from the moment the panel appears, so the empty table already has its final
 * shape and nothing shifts when the cards land.
 *
 * `.deal-fly` is the ONLY element the timeline touches. TradingCard drives its
 * own transform on .tc-card (pointer/gyro tilt + --scale) and each surface puts
 * its hover lift on the enclosing button, so all three transform owners sit on
 * separate elements and can never fight.
 *
 * Spans, not divs: these render inside <button>, which takes phrasing content.
 */
export function DealtSlot({ index, scale, register, children }) {
  const w = Math.round(CARD_W * scale);
  const h = Math.round(CARD_H * scale);
  return (
    <span className="deal-slot" style={{ width: w, height: h }}
          ref={(el) => register(index, el)}>
      <span className="deal-ghost" aria-hidden="true" />
      <span className="deal-fly">
        <span className="deal-face deal-face-back" aria-hidden="true" />
        <span className="deal-face deal-face-front">{children}</span>
      </span>
    </span>
  );
}

/** The stub the hand comes off. Give it the ref you pass to runCardDeal. */
export const DealDeck = React.forwardRef(function DealDeck({ spent = false }, ref) {
  return (
    <span className={`deal-deck${spent ? " is-spent" : ""}`} ref={ref} aria-hidden="true">
      <span className="deal-deck-card" />
      <span className="deal-deck-card" />
      <span className="deal-deck-card" />
    </span>
  );
});

/**
 * Build and start the deal. Returns the timeline, or null when there is
 * nothing to animate — callers treat null as "go straight to the dealt state"
 * rather than stranding the player on a button that does nothing.
 *
 * Measure at CLICK time, never at mount: the panel is fully laid out by the
 * time anyone can press the button, so every rect is honest and there is no
 * load-order race to lose.
 *
 * @param deck      the deck element (flight origin)
 * @param slots     .deal-slot elements, in deal order
 * @param onLanded  (i) => void, as each card finishes turning face-up
 * @param onDone    () => void, when the last card settles
 * @param captionSelector  optional caption to fade in with each card, looked
 *                         up on the slot's parent
 */
export function runCardDeal({ deck, slots, onLanded, onDone, captionSelector }) {
  const live = (slots || []).filter(Boolean);
  if (!deck || !live.length) return null;

  playSfx(SFX.shuffle, { volume: 0.55 });
  const dk = deck.getBoundingClientRect();

  const tl = gsap.timeline({
    defaults: { force3D: true },
    onComplete: () => {
      // Hand the elements back untransformed. Leaving an inline transform in
      // place would keep a composited layer alive per card for the rest of the
      // session — over a live WebGL scene, on desktop.
      gsap.set(live.map((s) => s.querySelector(".deal-fly")), {
        clearProps: "transform,willChange",
      });
      onDone?.();
    },
  });

  live.forEach((slot, i) => {
    const fly = slot.querySelector(".deal-fly");
    const ghost = slot.querySelector(".deal-ghost");
    if (!fly) return;
    const r = slot.getBoundingClientRect();
    // Centre-to-centre, because the flight also scales and scaling happens
    // about the centre — matching corners instead would drift by half the size
    // difference, which on the hero card is ~120px.
    const dx = dk.left + dk.width / 2 - (r.left + r.width / 2);
    const dy = dk.top + dk.height / 2 - (r.top + r.height / 2);
    const at = i * STAGGER;

    tl.fromTo(fly, {
      x: dx, y: dy,
      scale: r.width ? dk.width / r.width : 0.2,
      rotation: -16 + i * 7,     // fanned, so five cards don't fly in lockstep
      rotationY: 180,            // face-down off the deck
      // Local perspective, so the flip reads identically wherever the card is
      // mid-air. Perspective on the parent instead would skew it harder the
      // further the card sits from its slot.
      transformPerspective: 1200,
      opacity: 1,
      willChange: "transform",
    }, {
      x: 0, y: 0, scale: 1, rotation: 0,
      duration: FLIGHT, ease: "power3.out",
      // One hit per card, on the launch rather than the landing: the launch is
      // the percussive moment, and firing on both would be ten sounds in 1.3s.
      onStart: () => playSfx(SFX.deal, { volume: Math.max(0.2, DEAL_VOL - i * DEAL_DECAY) }),
    }, at);

    // It turns over as it arrives, not after — a card that lands and then
    // flips reads as two events instead of one gesture.
    tl.to(fly, {
      rotationY: 0,
      duration: FLIP_DUR, ease: "power2.inOut",
      // A card turning over is what unseals whatever names it. (A skip fires
      // these too: progress(1) still runs the callbacks it jumps over.)
      onComplete: () => onLanded?.(i),
    }, at + FLIP_AT);

    if (ghost) tl.to(ghost, { opacity: 0, duration: 0.3 }, at + FLIP_AT);
    // Each caption arrives with its own card, never before it.
    const cap = captionSelector && slot.parentElement?.querySelector(captionSelector);
    if (cap) tl.to(cap, { opacity: 1, duration: 0.28 }, at + FLIP_AT);
  });

  return tl;
}

/** Shared styles. Each surface concatenates this into its own <style>. */
export const DEAL_CSS = `
.deal-slot { position:relative; display:block; flex:none; }
.deal-ghost { position:absolute; inset:0; border:1px dashed rgba(47,214,214,0.32);
  border-radius:9px; background:
    repeating-linear-gradient(135deg, rgba(47,214,214,0.05) 0 6px, transparent 6px 12px); }
.deal-fly { position:absolute; inset:0; display:block; opacity:0;
  transform-style:preserve-3d; }
.deal-face { position:absolute; inset:0; display:block; backface-visibility:hidden;
  -webkit-backface-visibility:hidden; }
/* Face-UP is the RESTING state (rotationY 0), so when the deal ends the
   transform can be cleared outright and no composited layer is left behind. */
.deal-face-back { transform:rotateY(180deg);
  background:url("/TCG/cardBack.webp") center / cover no-repeat,
    linear-gradient(160deg, #0a221f, #050f0d 75%);
  border:1px solid rgba(255,210,58,0.45); border-radius:9px;
  box-shadow:0 0 20px rgba(255,210,58,0.18); }

.deal-deck { position:relative; display:block; flex:none; width:54px; height:75px;
  transition:opacity .45s ease, transform .45s ease; }
.deal-deck-card { position:absolute; inset:0; border-radius:5px;
  background:url("/TCG/cardBack.webp") center / cover no-repeat,
    linear-gradient(160deg, #0a221f, #050f0d 75%);
  border:1px solid rgba(255,210,58,0.4); box-shadow:0 2px 10px rgba(0,0,0,0.5); }
.deal-deck-card:nth-child(1) { transform:translate(-3px,-3px) rotate(-4deg); }
.deal-deck-card:nth-child(2) { transform:translate(-1px,-1px) rotate(2deg); }
.deal-deck.is-spent { opacity:0.2; transform:scale(0.94); }
`;
