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

    // The four candle flames, drawn over the table on its own rung, so they
    // stay on their wicks on tilt. On the live card each one flickers on its
    // own clock about its own wick (flames: x, y the wick in % of the layer,
    // r the window cut around that flame in px), far to near.
    { id: "prop1", z: ART_PLANES.subject, scale: 1, flames: [
      { x: 52.68, y: 25.25, r: 8 },
      { x: 53.12, y: 28.6, r: 10 },
      { x: 53.65, y: 34.45, r: 14 },
      { x: 52.48, y: 54.5, r: 18 },
    ] },
  ],
};
