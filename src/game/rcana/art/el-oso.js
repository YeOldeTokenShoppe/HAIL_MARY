// El Oso — the bear market, a Hazard. Three planes: a storm over the range
// far back, the grizzly breaking out of the window in front of the frame
// (his claws cross the banner, the way El Diablito's hand does), and the
// rockfall he kicks loose nearest of all.
//
// Paths are by convention: public/TCG/rcana/el-oso/<id>.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type (FRAME_BY_BOXES).

  // The storm's own colours, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1a1430 0%,#4a2a3a 45%,#e07a3a 100%)",

  layers: [
    { id: "scene", scale: 1.04, blur: 3 },
    // Drawn past the window on the right and below, so he rides in FRONT of
    // the frame; lifted a touch so the claws sit on the banner rather than
    // the quote. Drop to ART_PLANES.subject to crop him in the window instead.
    { id: "subject", z: ART_PLANES.figureFront, scale: 1, offset: { y: -3 } },
    { id: "prop", z: ART_PLANES.prop, scale: 1 },
  ],
};
