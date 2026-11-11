// Mardi Gras — the throws from the float, an Opportunity. Four planes behind
// the plate: the French Quarter street under the cathedral spires, the float
// with Our Lady and her masked krewe inside the window, the crowd reaching up
// for throws across the bottom, and the confetti nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/mardi-gras/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The evening sky over the Quarter's purple and gold, for the sliver past
  // the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#f0b4c8 0%,#6a3a9a 55%,#3a2050 100%)",

  layers: [
    // Far: the street and the cathedral, over-scaled a touch so no edge shows.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The float, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The crowd at the kerb, ahead of the float — their cut edge falls below
    // the window, so the banner hides it.
    { id: "prop", z: 16, scale: 1 },

    // The confetti — the top layer, nearest the window but still BEHIND the
    // plate (z < 44), so the frame clips it at its edge.
    { id: "prop1", z: 24, scale: 1 },
  ],
};
