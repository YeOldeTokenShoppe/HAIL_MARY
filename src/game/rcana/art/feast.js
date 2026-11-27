// The Feast of Perpetual Profit — the long table, an Opportunity. FULL ART:
// the picture fills the frame top to bottom and the words are set on it
// (RcanaCard3: fullArt). Three planes behind the plate: the flowered
// colonnade with the sun at its far end, on the scene rung; the table and the
// whole cast around it, glasses raised, on the subject rung; and the candle
// flames' sparks, drawn over the table on that same rung.
//
// No paths: public/TCG/rcana/feast/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Full art: no text box; the rules, flavor and name sit on the picture.
  fullArt: true,

  // No `frame`: the plate follows the card's type.

  // The hall's warm stone, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#f0d8a8 0%,#e8b878 50%,#c88a48 100%)",

  layers: [
    // Far: the colonnade, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The table and the company, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The five candle flames, drawn over the table on its own rung, so they
    // stay on their wicks on tilt. On the live card each one flickers on its
    // own clock about its own wick (flames: x, y the wick in % of the layer,
    // r the window cut around that flame in px), far to near.
    // Re-measured from prop1.webp on 2026-11-26, when the Feast was painted
    // again with Brent Crude at the table: the flames sit about three points
    // left of and above where they were, and there is a fifth, on the candle
    // fourth from the far end.
    { id: "prop1", z: ART_PLANES.subject, scale: 1, flames: [
      { x: 49.76, y: 21.94, r: 8 },
      { x: 50.27, y: 26.08, r: 10 },
      { x: 50.83, y: 32.05, r: 14 },
      { x: 49.36, y: 38.72, r: 19 },
      { x: 49.64, y: 52.7, r: 18 },
    ] },
  ],
};
