// Treasure Map — the island with its X, an Asset. Three planes behind the
// plate: open sea and sky, the island itself, and the unrolled map with its
// compass nearest the window.
//
// No paths: public/TCG/rcana/treasure-map/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sea's blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1a5fb8 0%,#1b7a8c 55%,#145f70 100%)",

  layers: [
    // Far: sea and sky, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The island, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The map and compass. Ahead of the island but still BEHIND the plate
    // (z < 44), so the window clips the scroll at the frame's edge and the
    // banner covers its foot.
    { id: "prop", z: 24, scale: 1 },
  ],
};
