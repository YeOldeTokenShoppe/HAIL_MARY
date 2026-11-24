// The Inheritance — the old man's portrait and the key he left, a called
// Event. Three planes behind the plate: the portrait itself, the patriarch in
// his chair against a violet wall, on the scene rung; the gilt frame around
// him, on the subject rung; and the hand holding out the key, nearest the
// window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/the-inheritance/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The wall's violet, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2a0a5a 0%,#3a1070 50%,#1a0640 100%)",

  layers: [
    // Far: the portrait and the wall, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // HIS EYES FOLLOW YOU. prop1 is the whites of the two eyes, on the portrait's own rung and at its scale, so
    // they stay on the face on tilt; it covers the eyes painted on the portrait. The irises are drawn in code
    // inside those shapes (`eyes`): where each rests, in % of the layer, and its radius in px of the card; `travel`
    // is how far they drift toward the tilt. `filter` takes the whites down from pure white to an old man's.
    { id: "prop1", z: ART_PLANES.scene, scale: 1.04, filter: "brightness(0.84) sepia(0.3)",
      eyes: { irises: [{ x: 44.75, y: 21.7, r: 3.5 }, { x: 49.85, y: 21.1, r: 3.6 }], travel: { x: 1.6, y: 0.9 } } },

    // The gilt frame, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The hand and the key — the top layer, nearest the window but still
    // BEHIND the plate (z < 44). Closer to the frame than the usual 24: a
    // quarter less travel against it on tilt, so the hand reads as reaching
    // out of the portrait rather than floating ahead of it.
    // Live card: a spark on the key.
    { id: "prop", z: 12, scale: 1, glints: [{ x: 31, y: 46.5, size: 0.8, color: "rgba(255,215,120,.6)" }] },
  ],
};
