// The Prediction Market — the carnival booth where you name your odds, a
// Location (the first printed). Three planes behind the plate: the striped
// PREDICTIONS awning with the 3+ / 5+ / 8 target board under a violet
// fairground sky; the dunk tank with the smug suit on the seat, on the subject
// rung; and the betting table with the eight-sided die and the YES / NO slips,
// nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/prediction-market/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The fairground's violet into the lamplit floor, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#3a1570 0%,#5a1f8a 55%,#8a3a3a 100%)",

  layers: [
    // Far: the booth and sky, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The dunk tank, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The betting table — the top layer, nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips it at the right edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
