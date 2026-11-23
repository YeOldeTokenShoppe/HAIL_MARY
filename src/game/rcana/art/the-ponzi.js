// The Ponzi — the bobblehead financier with his golden pyramid, a called
// Event. Four planes behind the plate: the boardroom, dark panelling beside a
// red curtain over a mahogany floor, on the scene rung; the pinstriped figure
// holding the pyramid on his red plinth, and his head on its spring, both on
// the subject rung (the body is drawn after the head, and rides with it on
// tilt); and the spotlight falling on him, nearest the window. Everything
// stays under the frame.
//
// No paths: public/TCG/rcana/the-ponzi/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The room's dark teal into the floor, for the sliver past the scene's edge
  // on tilt.
  backdrop: "linear-gradient(180deg,#0a2a2a 0%,#0e3838 60%,#4a2010 100%)",

  layers: [
    // Far: the boardroom, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The head on its spring, on the subject rung. (The head is `subject` and the body `prop` since 2026-11-22:
    // the body is drawn after it, so the collar covers the foot of the spring.)
    // Live card: it BOBBLES. `bobble` is the foot of the spring, in % of the layer: the head swings about that
    // point as the card is tipped, wobbles to rest, and nods now and then on its own.
    { id: "subject", z: ART_PLANES.subject, scale: 1, bobble: { x: 50, y: 29.5 } },

    // The body and the pyramid — on the SAME rung as the head, so the head stays on the neck on tilt.
    // Live card: gold sparks on the pyramid (`glints`).
    { id: "prop", z: ART_PLANES.subject, scale: 1, glints: [
      { x: 57.5, y: 28.6, size: 1, color: "rgba(255,215,120,.6)" }, { x: 48, y: 38.2, size: 0.7, color: "rgba(255,215,120,.6)" },
      { x: 67, y: 36, size: 0.7, color: "rgba(255,215,120,.6)" }, { x: 60, y: 40.3, size: 0.6, color: "rgba(255,215,120,.6)" }, { x: 62.5, y: 32.6, size: 0.6, color: "rgba(255,215,120,.6)" }] },

    // The spotlight — the top layer, nearest the window but still BEHIND the
    // plate (z < 44), so the frame clips it at its edge.
    { id: "prop1", z: 24, scale: 1 },
  ],
};
