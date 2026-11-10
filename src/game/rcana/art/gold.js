// Gold — the mother lode: the veined ore mound in the mine, an Asset. Three planes behind the
// plate: the timbered gallery, the mound itself, and the foreground ledges
// with drifting sparks nearest the window.
//
// No paths: public/TCG/rcana/gold/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.
  // The Gold metal border by default, on the bench and in print.
  metalFrame: "gold",

  // The mine's indigo, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0e1240 0%,#1c2060 55%,#0e1240 100%)",

  layers: [
    // Far: the gallery, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The mound, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // Ledges at the lower corners and sparks in the air. Ahead of the mound
    // but still BEHIND the plate (z < 44): the ledges' cut edges fall below
    // the window, so the banner hides them.
    { id: "prop", z: 24, scale: 1 },
  ],
};
