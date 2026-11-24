// Fall From Grace — the devil falling, a Calamity. Three planes behind the
// plate: the purple cloud deck with the city below and the sun above, on the
// scene rung; the devil himself, gilt wings dripping, tumbling past the
// window on the subject rung; and the loose feathers he sheds, nearest the
// window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/fall-from-grace/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sky's violet, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#3a0a6a 0%,#6a1a7a 55%,#b84a3a 100%)",

  layers: [
    // Far: the clouds, the city and the sun, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The devil, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The shed feathers — the top layer, nearest the window but still
    // BEHIND the plate (z < 44), so they drift ahead of him on tilt.
    { id: "prop", z: 24, scale: 1 },
  ],
};
