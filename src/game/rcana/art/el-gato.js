// El Gato — the cat on the card table, a Trader. Four planes: the courtyard
// arcade, the cat on the felt, the dealers' hands reaching across the table
// (behind the frame, ahead of the cat), and the paw swatting a Calamity card
// off the table, which rides IN FRONT of the frame.
//
// The paw takes figureFront (+52): just past the plate, so it reads as ink
// over the border without swimming away from the cat it belongs to on tilt.
// ART_PLANES.prop (+118) is the rung for a loose object if it should float
// further out.
//
// No paths: each layer's image is public/TCG/rcana/el-gato/<id>.webp by
// convention (see artPath in cardFace.js). prop1/prop2 are not ART_PLANES
// keys, so each names its own z.
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The courtyard's terracotta, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#e8a24a 0%,#c8602a 50%,#9a3a1c 100%)",

  layers: [
    // Far: the arcade and tiled floor. Opaque across the window.
    { id: "scene", scale: 1.04 },

    // The cat on the table, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The dealers' hands — ahead of the cat, still under the plate (+44).
    { id: "prop1", z: 14, scale: 1 },

    // The paw and the swatted Calamity card — in front of the frame.
    { id: "prop2", z: ART_PLANES.figureFront, scale: 1 },
  ],
};
