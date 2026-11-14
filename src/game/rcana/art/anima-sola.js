// Ánima Sola — the soul in the flames, a Grace. Three planes behind the
// plate: the stone arch opening onto the purgatory hills and the chapel on
// its ridge, the chained soul praying up through the smoke inside the
// window on the subject rung, and the flames licking up over the rocks
// nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/anima-sola/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The dusk's purple into the fire's orange, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#703d43 0%,#4a2a5a 50%,#c05a10 100%)",

  layers: [
    // Far: the arch and the hills, over-scaled a touch so no edge shows on
    // tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The chained soul, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The flames and the rocks — nearest the window but still BEHIND the
    // plate (z < 44), so the frame clips the fire at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
