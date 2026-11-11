// Seed Round — the coin that sprouts, an Asset. Three planes behind the
// plate: the sunrise over the fields, the cracked gold coin with its seedling
// inside the window, and the mound of turned soil at the coin's base nearest
// the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/seed-round/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The field's green under the sunrise, for the sliver past the scene's edge
  // on tilt.
  backdrop: "linear-gradient(180deg,#f4a06a 0%,#2f7a3c 55%,#1f5a2a 100%)",

  layers: [
    // Far: the sunrise and the hills, over-scaled a touch so no edge shows.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The coin and its seedling, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The soil mound at the coin's base — nearest the window but still
    // BEHIND the plate (z < 44), so the frame clips its lower edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
