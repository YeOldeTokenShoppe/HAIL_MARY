// Collectibles — the velvet case of graded cards inside the vault, an Asset.
// Three planes behind the plate: the vault door and its shaft of light, the
// case itself, and the holo sun card floating above it nearest the window.
//
// No paths: public/TCG/rcana/collectibles/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The vault's midnight blue under gold, for the sliver past the scene's
  // edge on tilt.
  backdrop: "linear-gradient(180deg,#0a1a3a 0%,#132a5a 55%,#0a1a3a 100%)",

  layers: [
    // Far: the vault, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The case of cards, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The floating holo card. A loose object with its own airspace, so it
    // drifts against the case on tilt — but still BEHIND the plate (z < 44).
    { id: "prop", z: 28, scale: 1 },
  ],
};
