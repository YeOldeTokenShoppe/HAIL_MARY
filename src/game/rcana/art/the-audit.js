// The Audit — the analyst catching the rug before it is pulled, a Relic.
// Three planes behind the plate: the panelled study in violet with its teal
// gothic window and the shelf; the auditor at her desk, finger on the HOLD
// line of the ledger screen, on the subject rung; and the console with its
// glowing gold button at the desk's near corner, nearest the window.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/the-audit/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The study's blue shadow into its violet floor, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#121a33 0%,#1e1a3a 55%,#2e1d3a 100%)",

  layers: [
    // Far: the study, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The auditor at her desk, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The console at the desk's corner — nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips it at the left edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
