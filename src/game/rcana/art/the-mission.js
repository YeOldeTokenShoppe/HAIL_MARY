// The Mission — the adobe cloister that looks after whoever is behind, a
// Location (the second printed). Three planes behind the plate: the desert at
// sunset, pink sky over dunes and saguaros, on the scene rung; the mission's
// arcade, pillars and a lit doorway under a beamed roof, on the subject rung;
// and the two carved saints standing in the arches, on that SAME rung, so
// they stay in their niches on tilt. Everything stays under the frame.
//
// No paths: public/TCG/rcana/the-mission/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunset's magenta into the sand, for the sliver past the scene's edge
  // on tilt.
  backdrop: "linear-gradient(180deg,#8a2a9a 0%,#f07a4a 45%,#b5562a 100%)",

  layers: [
    // Far: the desert, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The arcade, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The saints — drawn after the arcade but on the same rung (not nearer
    // the window), so they do not drift out of the arches on tilt.
    { id: "prop", z: ART_PLANES.subject, scale: 1 },
  ],
};
