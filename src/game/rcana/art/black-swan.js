// The Black Swan — the swan on the flooded nave, an Ambiguity. FULL ART: the
// picture fills the frame top to bottom and the words are set on it
// (RcanaCard3: fullArt). Three planes behind the plate: the drowned teal
// chapel with its tall windows, on the scene rung; and the swan itself with
// the ripples and its broken reflection drawn over it, both on the subject
// rung so the reflection never drifts off the bird.
//
// No paths: public/TCG/rcana/black-swan/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Full art: no text box; the rules, flavor and name sit on the picture.
  fullArt: true,

  // No `frame`: the plate follows the card's type.

  // The water's teal, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a3a3a 0%,#107a6a 50%,#0a3a3a 100%)",

  layers: [
    // Far: the flooded chapel, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The water: the ripples and the swan's reflection, on the subject rung. (Water is `subject` and the swan
    // `prop` since 2026-11-23: the swan is drawn after it, so it sits ON the water at its waterline.)
    // Live card: the water moves. `ripple` opens rings from the swan's waterline (x, y in % of the layer; rx their
    // widest half-width) and lets the layer sway, so the reflection wavers; `flare` makes its highlights shimmer (slow and at a third of full strength: at full it read as a pulsing flash).
    { id: "subject", z: ART_PLANES.subject, scale: 1, ripple: { x: 47, y: 59, rx: 46, period: 5 }, flare: { period: 7, strength: 0.3 } },

    // The swan — on the SAME rung as the water, so the bird and its reflection move as one on tilt.
    { id: "prop", z: ART_PLANES.subject, scale: 1 },
  ],
};
