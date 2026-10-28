// La Campana — the mission bell. Three planes, all behind the frame: El Sol
// over the mission far back, the bell in its stone arch, and bougainvillea
// hanging in front of the arch — still behind the plate, so the window crops
// all three together.
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
    // In front of the arch, behind the frame: no named rung, so the depth
    // is given outright, a little short of the plate. (+20 was tried and
    // tore the vine off the arch; 14px ahead keeps it hanging ON it.)
    { id: "prop", z: -8, scale: 1 },
  ],
};
