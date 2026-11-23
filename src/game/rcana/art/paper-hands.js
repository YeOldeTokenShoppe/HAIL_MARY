// Paper Hands — the hands that let go, a Calamity. Four planes behind the
// plate: the storm, teal cloud under a fork of red lightning, on the scene
// rung; the upper paper hand on the subject rung; the RL80 coin tumbling out
// of its grip with the torn scraps; and the lower hand, tearing as it grabs,
// nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/paper-hands/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The storm's teal, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1a3a3a 0%,#243f44 55%,#152a2e 100%)",

  layers: [
    // Far: the storm, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The upper hand, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The falling coin and scraps, a rung ahead of the upper hand. The coin
    // and the lower hand are spread in depth (10, 40): the tilt slides a
    // layer by its z, and two props a few units apart move as one.
    { id: "prop", z: 10, scale: 1 },

    // The lower hand, tearing as it grabs — the top layer, nearest the window
    // but still BEHIND the plate (z < 44), so the frame clips it at its edge.
    { id: "prop1", z: 40, scale: 1 },
  ],
};
