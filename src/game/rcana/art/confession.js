// Coin-Op Confession — the coin-operated booth with the robot confessor, a
// Grace. Three planes behind the plate: the chapel interior, violet faceted
// walls under two stained-glass lancets with the lamplit tile floor, on the
// scene rung; the red-and-gold booth itself, curtain drawn and the robot
// priest at the grille, on the subject rung; and the candle's flame, which
// flickers, on that same rung. Everything stays under the frame.
//
// No paths: public/TCG/rcana/confession/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The chapel's violet into the candlelit floor, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2a1a4a 0%,#3d2460 55%,#b05a2a 100%)",

  layers: [
    // Far: the chapel, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The booth, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The candle's flame — on the SAME rung as the booth (not nearer the window), so it stays on its
    // wick on tilt. `flicker` is the wick, in % of the layer: on the live card the flame stretches,
    // leans and dims a little about that point.
    { id: "prop", z: ART_PLANES.subject, scale: 1, flicker: { x: 49, y: 18 } },
  ],
};
