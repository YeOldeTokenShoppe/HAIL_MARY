// Garth Raider — the corporate raider in his armchair, a Trader. Four planes
// behind the plate: the office and the storm over the skyline on the scene
// rung; the golden-parachute lamp (subject.webp) standing behind the chair,
// on a rung of its own between the scene and the window; Garth in the chair
// (prop.webp) on the subject rung; and the side table with his trophy in
// front of him, nearer, on its own rung just behind the window.
//
// No paths: public/TCG/rcana/garth-raider/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The office's storm violet and mahogany, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2b1c3a 0%,#482b4e 50%,#3a1a10 100%)",

  layers: [
    // Far: the office and the skyline, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The lamp (subject.webp), BEHIND the chair: on a rung between the scene
    // (-68) and the subject rung (-22), and drawn before Garth.
    { id: "subject", z: -45, scale: 1 },

    // Garth in the armchair (prop.webp), inside the window on the subject rung.
    { id: "prop", z: ART_PLANES.subject, scale: 1 },

    // The side table, nearer than the chair but BEHIND the plate (z < 44).
    { id: "prop1", z: 24, scale: 1 },
  ],
};
