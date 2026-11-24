// Liquidity Trap — the padlocked font, a Calamity. Three planes behind the
// plate: the violet chapel with its candles and windows, on the scene rung;
// the stone font, barred and padlocked over its pool of coins, on the subject
// rung; and the coins still dropping in through the bars, nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/liquidity-trap/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The chapel's violet, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2a0a4a 0%,#4a1a6a 50%,#2a0a4a 100%)",

  layers: [
    // Far: the chapel, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The font, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The falling coins — the top layer, nearest the window but still
    // BEHIND the plate (z < 44), so they drift ahead of the font on tilt.
    { id: "prop", z: 24, scale: 1 },
  ],
};
