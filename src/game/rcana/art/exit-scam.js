// Exit Scam — the founder out the back door, a Calamity. Three planes
// behind the plate: the amber street beyond the doorway, the shuttered
// office with the CLOSED sign and the man hurrying out with the case of
// cash inside the window, and the mark in the foreground holding the
// worthless certificate nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/exit-scam/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The street's late amber into the office's green, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#422a14 0%,#b07a3a 45%,#1e3a2c 100%)",

  layers: [
    // Far: the street through the door, over-scaled a touch so no edge
    // shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The office and the man leaving it, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The hand and the certificate — nearest the window but still BEHIND the
    // plate (z < 44), so the frame clips the mark's shoulder at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
