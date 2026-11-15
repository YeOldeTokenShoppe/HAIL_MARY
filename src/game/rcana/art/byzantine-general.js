// El General — the Byzantine general and his two lieutenants, a Trader.
// Three planes behind the plate: the imperial purple sunburst with the
// double-headed eagle, the two generals in blue (the scroll-bearer and the
// spearman, the consensus he needs) inside the window on the subject rung,
// and the General himself in gold scale with his hands on his sword
// nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/byzantine-general/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunburst's imperial purple, for the sliver past the scene's edge on
  // tilt.
  backdrop: "linear-gradient(180deg,#7b0571 0%,#5a0466 55%,#3a0248 100%)",

  layers: [
    // Far: the sunburst and the eagle, over-scaled a touch so no edge shows
    // on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The two lieutenants, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The General — nearest the window but still BEHIND the plate (z < 44),
    // so the name banner clips his armour at its edge like a bust.
    { id: "prop", z: 24, scale: 1 },
  ],
};
