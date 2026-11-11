// Flash Crash — the exchange under the storm, a Calamity. Three planes behind
// the plate: the deco financial district under the thunderheads, the red
// price line plunging through the window, and the lightning nearest the
// window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/flash-crash/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The storm's navy over the lamplit street, for the sliver past the scene's
  // edge on tilt.
  backdrop: "linear-gradient(180deg,#0a1230 0%,#132a48 55%,#3a2410 100%)",

  layers: [
    // Far: the district and the storm, over-scaled a touch so no edge shows.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The plunging price line, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The lightning — nearest the window but still BEHIND the plate (z < 44),
    // so the frame clips the bolts at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
