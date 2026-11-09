// The Illumin80 — the masked figure with the glowing phone, an Event (an
// initiation, printed as an Opportunity). Three planes
// behind the plate: the dim chamber with its gilt sigils, the circle of
// hooded acolytes, and the figure itself nearest the window.
//
// No paths: public/TCG/rcana/the-illumin80/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The chamber's teal-black, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#07262c 0%,#0a1a26 55%,#050b14 100%)",

  layers: [
    // Far: the chamber, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The acolytes, between the chamber and the figure: a rung of their own
    // so they fall away behind the figure on tilt without pulling the wall.
    { id: "prop", z: -45, scale: 1 },

    // The figure, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
