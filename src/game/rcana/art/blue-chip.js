// Blue Chip — the old bank, an Asset. Three planes behind the plate: the
// deco towers under a clear sky, the bank itself with the blue chip set in
// its pediment inside the window on the subject rung, and the two
// gentlemen conferring on the steps nearest the window. Everything stays
// under the frame.
//
// No paths: public/TCG/rcana/blue-chip/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // Sky into the towers' limestone, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2a62c4 0%,#68768d 55%,#9a8a6a 100%)",

  layers: [
    // Far: the skyline, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The bank, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The two gentlemen on the steps — nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips them at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
