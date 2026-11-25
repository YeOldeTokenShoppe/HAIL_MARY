// La Ofrenda — the coin for the alms box, a Grace. Three planes behind the
// plate: the deep maroon with its rays, on the scene rung; the painted
// panel, a man in his suit dropping a coin into the little church box, on the
// subject rung; and the folk-art frame of flowers and the flaming heart,
// nearest the window, so the panel reads as hung inside it.
//
// No paths: public/TCG/rcana/the-offering/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The maroon, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#4a0a22 0%,#6a1030 50%,#3a0818 100%)",

  layers: [
    // Far: the rays, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The painted panel, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The folk-art frame — the top layer, nearest the window but still
    // BEHIND the plate (z < 44), so the panel shifts inside it on tilt.
    { id: "prop", z: 24, scale: 1 },
  ],
};
