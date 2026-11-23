// Back to the 80s — the portal, card 88 of 88, a Location. The first FULL ART
// card: the picture fills the frame top to bottom and the words are set on it
// (RcanaCard3: fullArt). Four planes behind the plate: the night highway under
// the stars, on the scene rung; the portal, a ring of lightning open on the
// synthwave sunset with its palms and grid, on the subject rung; the
// convertible with the crew aboard, tearing toward it, and the fire trails its
// tyres leave, both nearest the window on one rung.
//
// No paths: public/TCG/rcana/back-to-the-80s/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Full art: no text box; the rules, flavor and name sit on the picture.
  fullArt: true,

  // No `frame`: the plate follows the card's type.

  // The highway's midnight blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#05061e 0%,#141a6a 45%,#0a0c3a 100%)",

  layers: [
    // Far: the highway and the stars, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The portal, inside the window on the subject rung.
    // Live card: the layer flares (`crackle`), fresh forks leap out from the portal's rim (`bolts`: the rim as
    // an ellipse, in % of the layer) and sparks flash along it (`glints`).
    { id: "subject", z: ART_PLANES.subject, scale: 1, crackle: true, bolts: { cx: 47, cy: 32.5, rx: 30, ry: 15, count: 16 },
      glints: [{ x: 21, y: 22 }, { x: 74, y: 20, size: 1.2 }, { x: 80, y: 36 }, { x: 14, y: 38, size: 1.1 }, { x: 47, y: 15 }, { x: 60, y: 47, size: 0.9 }, { x: 30, y: 46, size: 0.9 }] },

    // The car, nearest the window but still BEHIND the plate (z < 44), so
    // the frame clips it at its edge.
    { id: "prop", z: 24, scale: 1 },

    // The fire trails — drawn last, on the SAME rung as the car that leaves
    // them, so they stay under its tyres on tilt.
    // Live card: the fire's highlights flash in place (`flare`; nothing moves), with embers (`glints`).
    { id: "prop1", z: 24, scale: 1, flare: {},
      glints: [{ x: 38, y: 66, size: 0.6, color: "rgba(255,150,40,.7)" }, { x: 22, y: 76, size: 0.7, color: "rgba(255,150,40,.7)" }, { x: 12, y: 86, size: 0.6, color: "rgba(255,150,40,.7)" },
        { x: 30, y: 82, size: 0.5, color: "rgba(255,150,40,.7)" }, { x: 90, y: 62, size: 0.6, color: "rgba(255,150,40,.7)" }, { x: 96, y: 70, size: 0.5, color: "rgba(255,150,40,.7)" }] },
  ],
};
