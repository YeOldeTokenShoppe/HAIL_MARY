// El Gambusino — the prospector mid-swing in his mine, a Trader. Two planes
// behind the plate (the timbered shaft with its gold vein, the figure) and
// flying rock shards in front of everything.
//
// No paths: public/TCG/rcana/el-gambusino/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The shaft's lamplit amber over dark rock, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1a0e08 0%,#3a2210 55%,#8a4a12 100%)",

  layers: [
    // Far: the mine, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The figure, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // Rock shards thrown by the pick, in FRONT of everything — figure and
    // frame alike — so they read as flying out of the card.
    { id: "prop", z: ART_PLANES.prop, scale: 1 },
  ],
};
