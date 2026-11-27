// The Airdrop — gold crates under parachutes, a Fate. Four planes behind the
// plate: the blue sky on the scene rung; two far chutes on rungs of their own
// between the sky and the window, the smallest deepest, so they drift against
// the near one on tilt; and the big crate itself on the subject rung.
//
// No paths: public/TCG/rcana/airdrop/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sky's blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#024da2 0%,#1498f6 50%,#62ade8 100%)",

  layers: [
    // Far: the sky, over-scaled a touch so no edge shows on tilt.
    // Live card: the sun in the corner swells and sinks (`glows`).
    { id: "scene", z: ART_PLANES.scene, scale: 1.04,
      glows: [{ x: 93, y: 6, r: 110, color: "255,225,150", period: 4.6, mode: "breathe", low: 0.35 }] },

    // The smallest chute, deepest of the three (between scene -68 and subject -22).
    // Live card: each parachute HANGS in the air. `rock` swings it from the
    // top of its canopy (x, y in % of the layer), `deg` either way, and
    // `wind` more degrees when the card is tipped fully sideways. `hover`
    // lets it sink a few px and lift again. Each keeps its own time.
    { id: "prop1", z: -52, scale: 1, rock: { x: 21.8, y: 29.1, deg: 3, wind: 5, period: 2.3 }, hover: { rise: -3, period: 4.1 } },

    // The middle chute, nearer than the small one, still behind the big crate.
    { id: "prop2", z: -40, scale: 1, rock: { x: 78.5, y: 18.4, deg: 2.6, wind: 5, period: 2.9 }, hover: { rise: -4, period: 4.7 } },

    // The big crate, inside the window on the subject rung.
    // The big one swings slowest, and its gold sparks (`glints`).
    { id: "subject", z: ART_PLANES.subject, scale: 1, rock: { x: 49, y: 20.4, deg: 2, wind: 5, period: 3.6 }, hover: { rise: -5, period: 5.3 },
      glints: [
        { x: 51.4, y: 42.2, size: 0.45, color: "rgba(255,225,140,.6)" },
        { x: 46.8, y: 45, size: 0.38, color: "rgba(255,225,140,.6)" },
        { x: 55.8, y: 44.6, size: 0.38, color: "rgba(255,225,140,.6)" },
      ] },
  ],
};
