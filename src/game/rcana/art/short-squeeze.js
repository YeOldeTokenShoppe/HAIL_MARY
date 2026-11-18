// Short Squeeze — the bear pinned in the lift, an Event. Three planes behind
// the plate: the deco lobby in teal with its gold columns, the gallery rail
// and the lamp on the far wall; the bear crammed into the gold elevator car,
// arrow lit UP, inside the window on the subject rung; and the light from
// the high window with the marble floor's gilt edge nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/short-squeeze/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The lobby's deep teal into the darker floor, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a4c4a 0%,#044443 55%,#03312f 100%)",

  layers: [
    // Far: the lobby, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The bear in the lift, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The window light and the marble floor edge — nearest the window but
    // still BEHIND the plate (z < 44), so the frame clips the floor's edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
