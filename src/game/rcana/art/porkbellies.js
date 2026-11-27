// Pork Bellies — the slabs on a butcher's table in the cold store, an Asset
// that ripens and then spoils. Two planes behind the plate: the warehouse and
// its freezer door on the scene rung, and the table itself inside the window.
//
// No paths: public/TCG/rcana/porkbellies/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The cold store's teal, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1f5a69 0%,#56afb8 50%,#396f74 100%)",

  layers: [
    // Far: the cold store, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The table and the bellies, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
