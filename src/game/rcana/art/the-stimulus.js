// The Stimulus — the reliquary money printer on the altar, a Remedy. Four
// planes behind the plate: the arched hall with the purple marble altar under
// a warm glow, on the scene rung; the gilded printer itself, star on top and
// the 80 bills rolling out, on that same rung; and two bills fluttering free,
// each nearer the window than the last. Everything stays under the frame.
//
// No paths: public/TCG/rcana/the-stimulus/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The hall's violet into the marble, for the sliver past the scene's edge
  // on tilt.
  backdrop: "linear-gradient(180deg,#5a1a7a 0%,#8a3a9a 45%,#4a1060 100%)",

  layers: [
    // Far: the hall and altar, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The printer — on the SAME rung as the altar it stands on (not the
    // subject rung), so it stays planted on the marble on tilt. Drawn after
    // the scene, and over-scaled with it so the two keep their register.
    { id: "subject", z: ART_PLANES.scene, scale: 1.04 },

    // The first loose bill, a rung ahead of the printer. The two bills are
    // spread in depth (10, 40): the tilt slides a layer by its z, and two
    // props a few units apart move as one.
    { id: "prop", z: 10, scale: 1 },

    // The second bill, curling up on the left — the top layer, nearest the
    // window but still BEHIND the plate (z < 44), so the frame clips it.
    { id: "prop1", z: 40, scale: 1 },
  ],
};
