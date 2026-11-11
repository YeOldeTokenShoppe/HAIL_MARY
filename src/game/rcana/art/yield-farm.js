// Yield Farm — the coin crop, an Asset. Three planes behind the plate: the
// furrowed field running up to the coin orchards and the hills, the red
// tractor inside the window on the subject rung, and the front row of coin
// plants with the basket of the harvest nearest the window. Everything stays
// under the frame.
//
// No paths: public/TCG/rcana/yield-farm/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The field's turned earth, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#5d670f 0%,#b84e14 55%,#8a3a10 100%)",

  layers: [
    // Far: the field and orchards, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The tractor, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The front row of coin plants and the basket — nearest the window but
    // still BEHIND the plate (z < 44), so the frame clips the leaves at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
