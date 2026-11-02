// La Campana — the mission bell. Three planes: El Sol over the mission far
// back, the bell in its arch with the bougainvillea (one sheet now) inside
// the window, and the ring of the bell — gold sound arcs either side of it —
// loose in the air in front of the frame.
//
// The scene's sky is only part-opaque at its margins, so the backdrop is the
// same blue: wherever the scene thins, it thins into itself.
// Paths are by convention: public/TCG/rcana/la-campana/<id>.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  backdrop: "#29b1e2",

  layers: [
    { id: "scene", scale: 1.04 },
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
    // The sound arcs are not attached to anything, so they take the full
    // prop rung: ahead of the plate, swinging against the bell on tilt the
    // way a ring in the air should. (The vine used to be the prop and sat at
    // -8 to stay ON the arch; it is painted into the subject sheet now.)
    { id: "prop", z: ART_PLANES.prop, scale: 1 },
  ],
};
