// El Gallo — the fighting rooster on the bracket, an Asset. Three planes
// behind the plate: the pink pueblo street with the blue arcade and the
// mission at sunset, the rooster crowing on his iron bracket inside the
// window on the subject rung, and the BOLSA bell hanging from the bracket
// on the same rung. Everything stays under the frame.
//
// No paths: public/TCG/rcana/el-gallo/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunset's coral into the street's shadow, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#c85f4e 0%,#e07060 50%,#5a2a20 100%)",

  layers: [
    // Far: the street and the sky, over-scaled a touch so no edge shows on
    // tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The rooster on his bracket, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The bell, on the subject rung with the bracket it hangs from, so the
    // two move as one on tilt.
    {
      id: "prop", z: ART_PLANES.subject, scale: 1,
      swingSound: "/audio/churchBell.mp3",
      swingOrigin: "32% 43%", // Hanging ring on the full prop image.
    },
  ],
};
