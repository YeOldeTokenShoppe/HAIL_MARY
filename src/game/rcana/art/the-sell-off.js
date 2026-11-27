// The Sell-Off (Token Unlock until 2026-11-26; the layers below still describe that scene) — the vault door swings open and the gold floods out, a Fate.
// Three planes behind the plate: the emerald hall on the scene rung; the
// vault and its spilled coins on the subject rung; and the bear stepping out
// in front of it, nearer, on its own rung just behind the window.
//
// No paths: public/TCG/rcana/the-sell-off/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The hall's emerald, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#02301a 0%,#0f5922 50%,#0a2a10 100%)",

  layers: [
    // Far: the emerald hall, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The vault door and the gold, inside the window on the subject rung.
    // Live card: the vault is still pouring.
    // `glows`: the light inside the vault swells and sinks (x, y in % of the
    // layer; r in px of the 512px card).
    // `flare`: a glimmer runs through the gold's own highlights; nothing moves.
    // `glints`: sparks on the coins and the door's hub.
    // `tarnish`: THE RULE, in the hand: tip the card and the gold loses its
    // colour and shine (0 = never, 1 = to grey). More supply, worth less.
    { id: "subject", z: ART_PLANES.subject, scale: 1, tarnish: 0.75,
      flare: { period: 6, strength: 0.35 },
      glows: [{ x: 24.5, y: 26.5, r: 62, ry: 50, color: "255,190,70", period: 3.8, mode: "breathe", low: 0.25 }],
      glints: [
        { x: 25.8, y: 34.2, size: 0.42, color: "rgba(255,225,140,.6)" },
        { x: 36.3, y: 41, size: 0.45, color: "rgba(255,225,140,.6)" },
        { x: 27.2, y: 49, size: 0.45, color: "rgba(255,225,140,.6)" },
        { x: 45.6, y: 58.6, size: 0.55, color: "rgba(255,225,140,.6)" },
        { x: 12.6, y: 56.6, size: 0.38, color: "rgba(255,225,140,.6)" },
        { x: 48.2, y: 28.8, size: 0.4, color: "rgba(255,225,140,.6)" },
      ] },

    // The bear, nearer than the vault but BEHIND the plate (z < 44).
    // The bear BREATHES (`breath`: where it stands, in % of the layer; it
    // swells a hair from there and settles).
    { id: "prop", z: 24, scale: 1, breath: { x: 80, y: 70, period: 3.4, rise: 0.014 } },
  ],
};
