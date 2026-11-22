// La Investigadora — the analyst with the monocle and star-chart tablet, a
// Trader. Three planes behind the plate: the scene, the figure, and the
// ledger-terminal projection (prop) nearest the window. (prop1/prop2, the
// lilies, were removed 2026-11-21.)
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

    // The terminal projection — the top layer, ahead of the figure but still
    // BEHIND the plate (z < 44), so the window clips it at the frame's edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
