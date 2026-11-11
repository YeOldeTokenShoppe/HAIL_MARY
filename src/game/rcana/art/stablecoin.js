// Stablecoin — the dollar coin in the stable, an Asset. Three planes behind
// the plate: the timber barn opening onto green hills, the horse at the
// stall door with the $1 coin bedded in the hay inside the window, and the
// stall's dressing — rope, lantern, horseshoe, bucket, the hay's front edge —
// nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/stablecoin/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The barn's timber orange, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#8a3a14 0%,#c8702a 50%,#a85a22 100%)",

  layers: [
    // Far: the barn, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The horse and the coin, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The stall's dressing — nearest the window but still BEHIND the plate
    // (z < 44), so the frame clips the rope, lantern and hay at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
