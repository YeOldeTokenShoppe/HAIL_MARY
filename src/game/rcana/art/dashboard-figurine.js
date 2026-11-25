// Dashboard Mary — La Virgencita on the dash, a Relic and an apparition for
// the road. Three planes behind the plate: the synthwave highway running at
// the sunset and the skyline, the I-80 shield at its shoulder, on the scene
// rung; and the dashboard itself with the little Guadalupe standing on it,
// glowing, cut out as her own file over the dash, together on the subject
// rung. On tilt the road slides past behind the windshield.
//
// No paths: public/TCG/rcana/dashboard-figurine/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Rainbow foil by default (2026-11-25), like the other apparitions: the
  // code-drawn frame prints this card in rainbow metal, and the painted frame
  // lays the Terminal Traders rainbow border over it. The binder's and bench's
  // metal controls can still override.
  metalFrame: "rainbow",

  // No `frame`: the plate follows the card's type.

  // The sunset's magenta over the grid's blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#5a1a7a 0%,#e04a8a 35%,#0a2a6a 100%)",

  layers: [
    // Far: the highway and the sky, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The dash, and the figure cut out on her own, drawn over it on the same
    // rung so she rides with the dash on tilt.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
    // Our Lady, on her own layer. She does not move (she is a figure, not a
    // bobblehead); her light is the apparition's halo (set/apparitions.js).
    { id: "prop", z: ART_PLANES.subject, scale: 1 },
  ],
};
