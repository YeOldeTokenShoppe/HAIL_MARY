// The Whale — the breaching whale, a Market Event. Three planes, all behind
// the plate (+44) so the window crops the stack: the sunlit sea and sky, the
// whale in the air, and the wave it breaks through, nearest the viewer.
//
// The wave's spray crosses the whale's belly, so it rides a little ahead of
// the subject rather than on the full prop rung: enough to lift the water
// off the whale on tilt, not enough to tear the spray from the body it
// splashes against (the same spacing as La Calavera's roses).
//
// No paths: public/TCG/rcana/the-whale/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sea's teal, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0e4a5a 0%,#1a6f78 55%,#0b4a4e 100%)",

  layers: [
    // Far: sky and open water. Opaque across the window.
    { id: "scene", scale: 1.04 },

    // The whale, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The breaking wave and spray — ahead of the whale, under the plate.
    { id: "prop", z: -8, scale: 1 },
  ],
};
