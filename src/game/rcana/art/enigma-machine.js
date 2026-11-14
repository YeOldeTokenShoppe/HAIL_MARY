// El Enigma — the cipher machine on the desk, a Relic. Three planes behind
// the plate: the listening-post office with the radio, the maps and the
// mast outside the window, the Enigma in its case under the green lamp
// inside the window on the subject rung, and the decoded sheet, the pinned
// map and the sealed envelope on the desk's near edge nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/enigma-machine/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The office's purple dusk into the desk's wood, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#692324 0%,#4a2050 45%,#8a3a10 100%)",

  layers: [
    // Far: the office and the desk, over-scaled a touch so no edge shows on
    // tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The machine and the lamp, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The papers on the desk's edge — nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips the map and envelope at its
    // bottom edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
