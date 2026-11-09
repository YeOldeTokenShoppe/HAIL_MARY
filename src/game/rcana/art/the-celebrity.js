// La Estrella (folder: the-celebrity) — the influencer on the red carpet, a
// Trader. Three planes behind the plate: the paparazzi line, the figure, and
// two foreground cameras at the lower corners nearest the window.
//
// No paths: public/TCG/rcana/the-celebrity/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The carpet's red under the lobby's gold, for the sliver past the scene's
  // edge on tilt.
  backdrop: "linear-gradient(180deg,#1a1030 0%,#6a1020 55%,#8a1418 100%)",

  layers: [
    // Far: the press line, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The figure, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // Two cameras shooting in from the lower corners. Ahead of the figure
    // but BEHIND the plate (z < 44): the sheet's flat bottom edge sits
    // below the window, so the banner hides it and the lenses read as
    // leaning in from off-card.
    { id: "prop", z: 24, scale: 1 },
  ],
};
