// Moral Hazard — the tightrope walker juggling over a safety net, an
// Ambiguity. Four planes behind the plate: the storm sky on the scene rung;
// the walker on his rope and the coins he juggles, both on the subject rung
// so the coins stay in his hands on tilt; and the net strung in front of him,
// nearer, on its own rung just behind the window.
//
// No paths: public/TCG/rcana/moral-hazard/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The storm's teal and violet, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a2a3a 0%,#063245 50%,#2a1a4a 100%)",

  layers: [
    // Far: the storm sky, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The walker on his rope, inside the window on the subject rung.
    // Live card: he SWAYS on the wire (`rock`: the pivot is his standing foot,
    // in % of the layer; `deg` either way; `period` seconds a swing). The wire
    // is on this layer and rocks with him. `glows`: the torch gutters.
    { id: "subject", z: ART_PLANES.subject, scale: 1, rock: { x: 49.5, y: 42.8, deg: 1.3, period: 2.6 },
      glows: [{ x: 78.6, y: 12.2, r: 30, color: "255,150,50", period: 1.9 }] },

    // The juggled coins — on the SAME rung as the walker, so they stay over
    // his hands.
    // The three coins travel along their arc and back (`rock` about the arc's
    // own centre, x 583, y 230 of 1027 x 1424): he is juggling.
    { id: "prop1", z: ART_PLANES.subject, scale: 1, rock: { x: 56.8, y: 16.2, deg: 6, bias: 4, period: 0.9 } }, // -2 to +10 degrees: any further back and the left coin crosses his hair

    // The safety net, nearer than the walker but BEHIND the plate (z < 44).
    // The net gives: it dips a few px of the card and comes back (`hover`,
    // with a negative `rise`).
    { id: "prop", z: 24, scale: 1, hover: { rise: -4, period: 3.4 } },
  ],
};
