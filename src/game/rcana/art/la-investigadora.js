// La Investigadora — the analyst with the monocle and star-chart tablet, a
// Trader. Three planes behind the plate: the sunburst sky and golden hills,
// the figure, and a lily stalk nearest the window. (prop1.webp, a single lily
// drawn for the front of the frame, is still in the folder but unused.)
//
// No paths: public/TCG/rcana/la-investigadora/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The scene's teal sky, for the sliver past its edge on tilt.
  backdrop: "linear-gradient(180deg,#0f7f8f 0%,#1a9aa6 55%,#e8b53a 100%)",

  layers: [
    // Far: the sky and hills, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The figure, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The lily stalk at bottom-left. Ahead of the figure but still BEHIND
    // the plate (z < 44), so the window clips it at the frame's edge.
    { id: "prop2", z: 24, scale: 1 },
  ],
};
