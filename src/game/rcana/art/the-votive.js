// The Votive (El Exvoto) — the tall glass candle on the altar, a Grace. Three
// planes behind the plate: the stone arch and its teal wall, with the candle's
// glow and the stained-glass chart, on the scene rung; the altar, the glass
// candle with Our Lady on its label, the rosary and the coins, on the subject
// rung; and the flame, on its own layer so it can burn.
//
// No paths: public/TCG/rcana/the-votive/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The wall's teal, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0e3a44 0%,#14505a 45%,#0a2c38 100%)",

  layers: [
    // Far: the arch, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The altar and the candle.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The flame, on the SAME rung as the candle so it stays on its wick when
    // the card tilts. `flicker` is the wick: the foot of the flame, in % of
    // the layer (x 514 of 1027, y 186 of 1424), where it meets the wax.
    { id: "prop", z: ART_PLANES.subject, scale: 1, flicker: { x: 50, y: 13.1 } },
  ],
};
