// Rug Pull — the goblin yanking the carpet in the gilded hall, a Calamity.
// Three planes behind the plate: the hall with the goblin and his rug, the
// mark's upended legs flying inside the window, and the coins and bill
// scattering nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/rug-pull/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The hall's green-gold marble, for the sliver past the scene's edge on
  // tilt.
  backdrop: "linear-gradient(180deg,#0f2a24 0%,#1c4a3c 55%,#2a5a46 100%)",

  layers: [
    // Far: the hall, the goblin and the rug, over-scaled a touch so no edge
    // shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The mark's legs, mid-tumble, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The coins and the bill — nearest the window but still BEHIND the plate
    // (z < 44), so the frame clips them at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
