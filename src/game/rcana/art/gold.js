// Gold — the mother lode, an Asset. Two planes behind the plate: the
// timbered gallery, and the foreground ledges with drifting sparks nearest
// the window. (subject.webp, the ore mound, is still in the folder but unused.)
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

    // Ledges at the lower corners and sparks in the air, nearest the window
    // but still BEHIND the plate (z < 44): the ledges' cut edges fall below
    // the window, so the banner hides them.
    { id: "prop", z: 24, scale: 1 },
  ],
};
