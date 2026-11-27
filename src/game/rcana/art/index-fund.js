// Index Fund — a basket with the whole town in it, an Asset that is spread
// too wide to rug. Two planes behind the plate: the plaza and the skyline on
// the scene rung, and the basket itself inside the window.
//
// No paths: public/TCG/rcana/index-fund/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The morning's cream and the plaza's stone, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#d0c5a2 0%,#ffdda9 50%,#907b65 100%)",

  layers: [
    // Far: the plaza and the town, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The basket, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
