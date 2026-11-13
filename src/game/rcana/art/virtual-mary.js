// The Virtual Mary — the hologram in the chamber, an Ambiguity. Four
// planes behind the plate: the dark chamber with its lit arch and the
// emitter pad, Our Lady projected in cyan above the pad inside the window
// on the subject rung, the emitter's glow at her feet a step ahead of her,
// and the console in the corner topmost, nearest the window. Everything
// stays under the frame.
//
// No paths: public/TCG/rcana/virtual-mary/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The chamber's teal dark, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#10353f 0%,#0a2630 55%,#030a0e 100%)",

  layers: [
    // Far: the chamber and the arch, over-scaled a touch so no edge shows
    // on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The projection, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The emitter's glow at her feet — a step ahead of her, under the plate.
    { id: "prop1", z: 8, scale: 1 },

    // The console — topmost, nearest the window but still BEHIND the plate
    // (z < 44), so the frame clips it at the window's corner.
    { id: "prop", z: 24, scale: 1 },
  ],
};
