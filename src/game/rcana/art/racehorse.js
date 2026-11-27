// Racehorse — the chestnut at full stretch down the home straight, an Asset
// and a gamble. Two planes behind the plate: the track and the grandstand on
// the scene rung, and the horse and her jockey inside the window.
//
// No paths: public/TCG/rcana/racehorse/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The track's dirt under the afternoon sky, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#a17b50 0%,#f28624 50%,#944e14 100%)",

  layers: [
    // Far: the track and the stands, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The horse and jockey, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
