// El Tatuaje — Our Lady inked on the shoulder, a Relic. Three planes behind
// the plate: the parlour with the artist in her red beanie, the green lamp,
// the flash on the wall and the curtain; the client on the stool with the
// Guadalupe fresh on his arm and the needle at work, inside the window on
// the subject rung; and the ink-cap tray on its arm nearest the window.
// Everything stays under the frame.
//
// The scene is authored inset a touch (a 9% clear band along the bottom,
// 3% at the top) — the bottom lies under the plate and the over-scale
// covers the rest, with the backdrop behind for the sliver on tilt.
//
// No paths: public/TCG/rcana/el-tatuaje/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The parlour's purple wall into the dark floorboards, for the sliver past
  // the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#4a1d5a 0%,#5c2466 55%,#2a1430 100%)",

  layers: [
    // Far: the parlour, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The client and the needle, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The ink caps on the tray — nearest the window but still BEHIND the
    // plate (z < 44), so the frame clips the tray at its left edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
