// Nuestra Señora en Fuego — Our Lady on the fire horse, an Opportunity.
// Three planes behind the plate: the blue sky and its sunset cloud banks,
// Our Lady on the rearing horse with the sun staff inside the window on the
// subject rung, and the horse's flame breath with the front cloud bank
// nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/fire-horse/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sky's blue into the clouds' gold, for the sliver past the scene's
  // edge on tilt.
  backdrop: "linear-gradient(180deg,#3a62c0 0%,#607aac 50%,#e0a070 100%)",

  layers: [
    // Far: the sky and the clouds, over-scaled a touch so no edge shows on
    // tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // Our Lady and the horse, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The flame breath and the front clouds — nearest the window but still
    // BEHIND the plate (z < 44), so the frame clips the fire at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
