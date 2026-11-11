// La Horchata — the cold glass on the tiled table, a Remedy. Two planes
// behind the plate: the sunlit courtyard with its bougainvillea and teal
// door, and the table with the glass, vase, rice and cinnamon inside the
// window. (prop.webp, the glass on its own, is still in the folder but
// unused: the drink is drawn into subject.webp now.)
//
// No paths: public/TCG/rcana/la-horchata/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The courtyard's terracotta, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#d8705a 0%,#e09a6a 50%,#c47a4e 100%)",

  layers: [
    // Far: the courtyard, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The table with the drink, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
