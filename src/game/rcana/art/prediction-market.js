// The Prediction Market — the racetrack where you name your odds, a Location
// (the first printed). Re-drawn 2026-11-22 (it was a carnival dunk-tank booth
// until then). Four planes behind the plate: the track under a lavender sky,
// grandstand on the far rail and the lit tote board with the 3+ / 5+ / 8
// contracts, on the scene rung; then the three runners, each nearer the window
// than the last — the grey with the 3 on the subject rung, the bay with the 8
// on `prop`, and the chestnut with the 5 on `prop1`, the top layer. Everything
// stays under the frame.
//
// No paths: public/TCG/rcana/prediction-market/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The evening sky into the dirt of the track, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#6a4a9a 0%,#c98a7a 40%,#8a4a2a 100%)",

  layers: [
    // Far: the track and tote board, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The grey runner (3), inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The bay runner (8), a rung nearer the window. The three runners are
    // spread evenly in depth (-22, 6, 40): the tilt slides a layer by its z,
    // and two props a few units apart move as one.
    { id: "prop", z: 6, scale: 1 },

    // The chestnut runner (5) — the top layer, nearest the window but still
    // BEHIND the plate (z < 44), so the frame clips it at the edge.
    { id: "prop1", z: 40, scale: 1 },
  ],
};
