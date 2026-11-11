// Tax Collector — the man from the Tax Office, a Calamity. Two planes behind
// the plate (the skyline at dusk, the collector on his steps) and his
// outstretched arm with the bill in front of the frame.
//
// No paths: public/TCG/rcana/tax-collector/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The dusk's amber over the treeline, for the sliver past the scene's edge
  // on tilt.
  backdrop: "linear-gradient(180deg,#f0a040 0%,#f5b860 50%,#2e4a3a 100%)",

  layers: [
    // Far: the skyline, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The collector, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // His arm and the tax bill, in FRONT of the frame. The figureFront rung
    // (just above the plate) rather than the loose-prop rung, because the
    // arm is attached: too much lift and it tears off the shoulder on tilt.
    { id: "prop", z: ART_PLANES.figureFront, scale: 1 },
  ],
};
