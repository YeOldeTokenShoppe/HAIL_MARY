// Scandal — the headline on the rainy street, a Calamity. Three planes
// behind the plate: the wet deco avenue with the newsboy at the corner, the
// woman in the plum trench coat turning her collar up inside the window,
// and the lamplit newsstand with the EXTRA! sheets nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/scandal/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The street's rain-slick blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1c2a36 0%,#24445a 55%,#102030 100%)",

  layers: [
    // Far: the avenue and the newsboy, over-scaled a touch so no edge shows
    // on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The woman in the trench coat, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The newsstand and its headlines — nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips the stand and lamp at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
