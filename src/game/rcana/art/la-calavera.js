// La Calavera — the skull on its cushion, with roses in front of the
// subject but inside the frame. All three layers share the window crop.
// Paths follow public/TCG/rcana/la-calavera/<id>.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  backdrop: "#267f87",
  layers: [
    { id: "scene", scale: 1.04 },
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
    { id: "prop", z: -8, scale: 1 },
  ],
};
