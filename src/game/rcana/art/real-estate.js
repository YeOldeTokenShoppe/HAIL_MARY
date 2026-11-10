// Real Estate — the brownstone at dusk, an Asset. Three planes behind the
// plate: the park and skyline, the house itself, and the fence with its For
// Sale sign and floating key nearest the window.
//
// No paths: public/TCG/rcana/real-estate/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunset's peach to coral, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#f28a6a 0%,#f7b07a 55%,#2f6a4a 100%)",

  layers: [
    // Far: the park and skyline, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The house, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The fence, sign and key. Ahead of the house but still BEHIND the plate
    // (z < 44), so the window clips the fence at the frame's edges.
    { id: "prop", z: 24, scale: 1 },
  ],
};
