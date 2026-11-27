// The Short — red boxers pinned to a clothesline that falls like a chart,
// over a rooftop at sunset. An Event. Three planes behind the plate: the
// sunset sky and the city on the scene rung; the rooftop parapet on the
// subject rung; and the line with the shorts strung in front of it, nearer,
// on its own rung just behind the window.
//
// No paths: public/TCG/rcana/the-short/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunset's violet and orange, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#8b42d1 0%,#f75c57 50%,#3a1a4a 100%)",

  layers: [
    // Far: the sunset and the skyline, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The rooftop, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The clothesline and the shorts, nearer than the roof but BEHIND the plate (z < 44).
    { id: "prop", z: 24, scale: 1 },
  ],
};
