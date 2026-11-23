// The Inferno — the gate of hell, a Calamity. Four planes behind the plate:
// the pit itself, terraces of fire with the stair winding down them, on the
// scene rung; the gate, "Lasciate ogni speranza" cut over its lintel, on the
// subject rung; the cat watching from the cliff edge, a rung ahead of it; and
// the flames licking up from the foreground, nearest the window. Everything
// stays under the frame.
//
// No paths: public/TCG/rcana/the-inferno/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The pit's ember red, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#3a0808 0%,#8a1a0a 50%,#2a0606 100%)",

  layers: [
    // Far: the pit and the stair, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The gate, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The cat on the cliff, a rung ahead of the gate. The cat and the flames
    // are spread in depth (10, 40): the tilt slides a layer by its z, and two
    // props a few units apart move as one.
    { id: "prop", z: 10, scale: 1 },

    // The flames — the top layer, nearest the window but still BEHIND the
    // plate (z < 44), so the frame clips them at its edge.
    { id: "prop1", z: 40, scale: 1 },
  ],
};
