// The Lottery Ticket — the L80 Luck scratcher, a Relic. Three planes behind
// the plate: the pink sunburst, the gold ticket with the beckoning cat in its
// scratch window on the subject rung, and the hand with the sun coin coming
// in from the right to scratch it, nearest the window. Everything stays
// under the frame.
//
// No paths: public/TCG/rcana/lottery-ticket/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunburst's hot pink into its darker rays, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#e2457f 0%,#c41f5f 55%,#a51650 100%)",

  layers: [
    // Far: the sunburst, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The ticket, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The scratching hand and its coin — nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips the wrist at its right edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
