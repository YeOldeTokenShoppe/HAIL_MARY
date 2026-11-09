// La Rosa — the rose before the niche, a Grace. Two planes behind the plate:
// the green shrine niche with its soft Guadalupe, and the rose itself inside
// the window.
//
// No paths: public/TCG/rcana/la-rosa/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The niche's deep green, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0b3a2e 0%,#0e5a44 50%,#0b3a2e 100%)",

  layers: [
    // Far: the niche (scene.webp). An alternate, scene2.webp, is still in
    // the folder — swap the id to try it again.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The rose, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
