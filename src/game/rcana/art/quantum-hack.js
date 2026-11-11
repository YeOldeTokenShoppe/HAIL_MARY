// Quantum Hack — the hooded hacker in the matrix hall, a Calamity. Four
// planes behind the plate: the code-rain hall with its floating terminals,
// the hacker inside the window, the haloed quantum cube hovering between his
// hands just ahead of him, and the falling code glyphs nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/quantum-hack/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The hall's violet-to-green, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1a0a3a 0%,#2a1060 50%,#0a3a2a 100%)",

  layers: [
    // Far: the hall and the code rain, over-scaled a touch so no edge shows.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The hacker, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The quantum cube, a step ahead of the hands that hold it.
    { id: "prop", z: 8, scale: 1 },

    // The falling glyphs — the top layer, nearest the window but still
    // BEHIND the plate (z < 44), so the frame clips them at its edge.
    { id: "prop1", z: 24, scale: 1 },
  ],
};
