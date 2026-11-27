// The Motherboard — Our Lady traced in copper on the green board, a Relic and
// an apparition. Three planes behind the plate: the warm amber ground on the
// scene rung; and the board itself with the two memory sticks seated in its
// expansion slots, both on the subject rung so the sticks never leave their
// slots on tilt.
//
// No paths: public/TCG/rcana/motherboard/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Rainbow foil by default, like the other apparitions: the code-drawn frame
  // prints this card in rainbow metal, and the painted frame lays the Terminal
  // Traders rainbow border over it. The binder's and bench's metal controls
  // can still override.
  metalFrame: "rainbow",

  // No `frame`: the plate follows the card's type.

  // The ground's amber, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#070b2c 0%,#101a52 55%,#1c1450 100%)", // the night sky's blue (it was the parchment's amber)

  layers: [
    // Far: the amber ground, over-scaled a touch so no edge shows on tilt.
    // `sky`: a starry night drawn in code OVER this layer, so the amber ground
    // in scene.webp is no longer seen (remove `sky` to bring it back). `stars`
    // is how many, `gold` the share of them that are gold, `seed` reshuffles
    // where they fall; `top`/`mid`/`bottom`/`glow` are its colours.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04, sky: { stars: 70, gold: 0.3, seed: 3 } },

    // The board, inside the window on the subject rung.
    // Live card: the board is POWERED. (Positions re-measured for the wider board, 2026-11-25.)
    // `current`: light runs out along the gold traces from the heart (x, y in
    // % of the layer), a pulse on every heartbeat; `reach` is how far it
    // runs (px of the 512px card), `period` the seconds a pulse takes,
    // `pulses` how many are on the board at once.
    // `glows`: the heart thumps (`mode: "thump"`, in time with the pulses),
    // and the empty slot, the third, breathes gold (`mode: "breathe"`).
    { id: "subject", z: ART_PLANES.subject, scale: 1,
      current: { x: 50, y: 35.5, reach: 340, period: 3.2, pulses: 2, strength: 0.9 },
      glows: [
        { x: 50, y: 35.9, r: 34, color: "255,90,70", period: 1.6, mode: "thump" },
        { x: 49.9, y: 56.4, r: 92, ry: 20, color: "255,200,90", period: 3.4, mode: "breathe", low: 0.3 },
      ] },

    // The memory sticks — on the SAME rung as the board, so they stay seated
    // in their slots.
    { id: "prop", z: ART_PLANES.subject, scale: 1 },
  ],
};
