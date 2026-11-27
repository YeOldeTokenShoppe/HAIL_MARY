// Brent Crude — the oil man on the phone, one boot on a barrel, a Trader
// (The Prospector until 2026-11-26; his mine, art/el-gambusino.js, is kept on
// file). Two planes behind the plate: the oil field at sunset on the scene
// rung, and Brent himself inside the window.
//
// No paths: public/TCG/rcana/brent-crude/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunset's magenta over the red dirt, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#753351 0%,#9a4056 45%,#7a4e44 100%)",

  layers: [
    // Far: the oil field, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // Brent and his barrel, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
