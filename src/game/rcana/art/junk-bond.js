// Junk Bond — the high-yield certificate on the factory loading dock, an
// Asset that pays until it defaults. Two planes behind the plate: the brick
// works under the red sky on the scene rung, and the bond with its coins
// inside the window.
//
// No paths: public/TCG/rcana/junk-bond/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sky's maroon over the brick, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#370e1f 0%,#8f472b 50%,#38201e 100%)",

  layers: [
    // Far: the factory and the dock, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The bond and its coins, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
