// The Savings Bond — grandmother's envelope on the table, an Asset. The
// table and the bear's shadow cast across it share the scene rung (a shadow
// lies on its surface, so it must drift with it), and the red envelope with
// the bond, the marigold and the "Para ti" note sits just ahead of them.
// Everything stays under the frame.
//
// All three are over-scaled alike so they stay registered to one another:
// `scale` is a plain enlargement about the card's centre, not a function of
// depth, so layers meant to align must share it.
//
// No paths: public/TCG/rcana/savings-bond/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The table's warm wood, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#b55202 0%,#d88a1a 50%,#8a4a08 100%)",

  layers: [
    // Far: the tabletop, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The bear's shadow, on the table's own rung so it stays on the wood.
    { id: "subject", z: ART_PLANES.scene, scale: 1.04, fadingShadow: true },

    // The envelope and the bond — a step ahead of the table, still deep
    // behind the plate.
    {
      id: "prop", z: ART_PLANES.scene + 12, scale: 1.04,
      // Centre of the embossed seal on the full foreground canvas.
      sealLight: { width: 1070, height: 1470, x: 705, y: 754, rx: 94, ry: 91 },
    },
  ],
};
