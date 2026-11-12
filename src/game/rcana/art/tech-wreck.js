// Tech Wreck — the scrapyard at the next exit, a Calamity. Three planes
// behind the plate: the desert yard with the crane dropping another server
// onto the pile, the WE BUY WRECKED TECH! billboard inside the window on
// the subject rung, and the roadside fence with the heaped monitors, racks
// and solar panels nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/tech-wreck/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // Sky into the yard's dust, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2a62c4 0%,#e0905a 50%,#c07a40 100%)",

  layers: [
    // Far: the yard and the crane, over-scaled a touch so no edge shows on
    // tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The billboard, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The fence, the pile and the road — nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips the panels at its edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
