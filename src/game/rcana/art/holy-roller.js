// The Holy Roller — Our Lady on a skateboard down the avenue, an
// Opportunity. Two planes behind the plate: the tree-lined avenue with the
// crowd and the green-candle banners, and Our Lady carving across the
// window on her board, on the subject rung. Everything stays under the
// frame.
//
// prop.webp in the folder is a blank export (the shiba from the first
// version) and is not used.
//
// No paths: public/TCG/rcana/holy-roller/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The avenue's sky into its asphalt, for the sliver past the scene's edge
  // on tilt.
  backdrop: "linear-gradient(180deg,#4a7ad0 0%,#876863 45%,#3a3a40 100%)",

  layers: [
    // Far: the avenue and the crowd, over-scaled a touch so no edge shows
    // on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // Our Lady on the board, inside the window on the subject rung — her
    // cape and the board's tail clip at the frame's edge.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
