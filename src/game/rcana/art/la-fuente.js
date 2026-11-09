// La Fuente — the courtyard fountain, a Grace.
// Three planes behind the plate: the arcaded courtyard at dusk, the
// fountain, and a tossing hand nearest the window.
//
// No paths: public/TCG/rcana/la-fuente/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // Dusk over terracotta, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#3a1f5a 0%,#b85a3a 55%,#e08a4a 100%)",

  layers: [
    // Far: the courtyard, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The fountain, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // A hand tossing two coins, entering from the right edge. Ahead of the
    // fountain but still BEHIND the plate (z < 44), so the window clips the
    // sleeve at the frame's edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
