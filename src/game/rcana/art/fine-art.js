// Fine Art — the reclining bronze on its plinth in a white gallery, an Asset
// for the collector. Two planes behind the plate: the gallery wall with its
// two canvases on the scene rung, and the bronze itself inside the window.
//
// No paths: public/TCG/rcana/fine-art/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The gallery's warm white, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#9c8e81 0%,#d6c9be 50%,#9a9594 100%)",

  layers: [
    // Far: the gallery, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The bronze on its plinth, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
