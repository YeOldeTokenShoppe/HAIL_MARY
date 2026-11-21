// The Lowrider (Ride or Die) — the lowrider under Our Lady of the boulevard, an Asset. Three
// planes: the street and skyline behind the plate, her apparition hovering
// over it inside the window, and the car itself in front of the frame.
//
// No paths: public/TCG/rcana/ride-or-die/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Rainbow foil by default (2026-11-20): the code-drawn frame prints this card
  // in rainbow metal, and the painted frame lays the Terminal Traders rainbow
  // border over it. The binder's and bench's metal controls can still override.
  metalFrame: "rainbow",

  // No `frame`: the plate follows the card's type.

  // The sky's blue over the asphalt, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2f8fd8 0%,#7fb6e0 55%,#4a5a7a 100%)",

  layers: [
    // Far: the boulevard and the skyline, over-scaled a touch so no edge
    // shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // Our Lady over the skyline, inside the window on the subject rung, so
    // she drifts against the street on tilt and stays BEHIND the plate.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The car, in FRONT of the frame on the figureFront rung, so its smoke
    // and wheels spill over the border and the banner.
    { id: "prop", z: ART_PLANES.figureFront, scale: 1 },
  ],
};
