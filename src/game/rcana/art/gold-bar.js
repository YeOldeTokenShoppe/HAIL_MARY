// Gold Bar — the stack of bullion before the open vault, an Asset. Two planes
// behind the plate: the vault and its steel floor on the scene rung, and the
// bars themselves inside the window.
//
// No paths: public/TCG/rcana/gold-bar/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The vault's steel blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1c2a3a 0%,#1c4c68 50%,#2a3040 100%)",

  layers: [
    // Far: the vault, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The bars, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
