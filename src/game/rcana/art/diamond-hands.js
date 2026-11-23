// Diamond Hands — the crystal hands holding the RL80 coin, a Relic. Three
// planes behind the plate: the dark showcase, a navy void over a run of purple
// velvet, on the scene rung; the hands themselves on their marble-and-gold
// base, on the subject rung; and the velvet's front fold, nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/diamond-hands/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The showcase's navy into the velvet, for the sliver past the scene's
  // edge on tilt.
  backdrop: "linear-gradient(180deg,#060a2a 0%,#0a1040 70%,#4a0a6a 100%)",

  layers: [
    // Far: the void and the velvet, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The hands, inside the window on the subject rung.
    // `glints` are sparks on the facets (and one each on the coin's rim and the cuffs' studs, in gold):
    // points in % of the layer, flaring one after another on the live card. Add, move or drop points freely.
    { id: "subject", z: ART_PLANES.subject, scale: 1, glints: [
      { x: 22, y: 28.5 }, { x: 63.5, y: 14, size: 1.1 }, { x: 33, y: 41 }, { x: 79, y: 28, size: 1.2 }, { x: 29, y: 22 }, { x: 67, y: 41 },
      { x: 36, y: 14, size: 1.1 }, { x: 74, y: 36 }, { x: 27, y: 35, size: 1.2 }, { x: 72, y: 21 }, { x: 37, y: 45.5, size: 0.8 }, { x: 64, y: 45.5, size: 0.8 },
      { x: 31, y: 19.5, size: 0.8 }, { x: 81.5, y: 30, size: 0.8 },
      { x: 33, y: 53, size: 0.7, color: "rgba(255,215,120,.6)" }, { x: 70, y: 53, size: 0.7, color: "rgba(255,215,120,.6)" }, { x: 41, y: 17, size: 0.9, color: "rgba(255,215,120,.6)" },
    ] },

    // The velvet's front fold — the top layer, nearest the window but still
    // BEHIND the plate (z < 44), so the frame clips it at the edges.
    { id: "prop", z: 24, scale: 1 },
  ],
};
