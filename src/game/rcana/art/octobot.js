// El Octobot — the octobot on the trading floor, a Trader. Three planes
// behind the plate: the floor's wall of market screens under the fanlight,
// the octobot with a phone in every reach inside the window on the subject
// rung, and its control console nearest the window. Everything stays under
// the frame.
//
// No paths: public/TCG/rcana/octobot/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The floor's screen-lit teal into its purple, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1b4f5f 0%,#2a1a6a 55%,#19175e 100%)",

  layers: [
    // Far: the screens and the floor, over-scaled a touch so no edge shows
    // on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The octobot, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The console — nearest the window but still BEHIND the plate (z < 44),
    // so the name banner clips it at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
