// The Keys — self-custody: a Relic that keeps Quantum Hack and Exit Scam off you. (The subject layer still
// shows the rug from when they cleared Rug Pull; it is being repainted without it.) Three planes
// behind the plate: the vaulted crypt in violet and teal with its lamplit
// flagstones; the rolled rug with its sprung padlock lying on the floor on the
// subject rung; and the gold-and-silver keys on their emerald ring hanging
// over it, nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/the-keys/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The crypt's teal shadow into the violet floor, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#132e3d 0%,#1d2a4a 55%,#3a2a52 100%)",

  layers: [
    // Far: the crypt, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The rug and the open padlock, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The keys — nearest the window but still BEHIND the plate (z < 44).
    { id: "prop", z: 24, scale: 1 },
  ],
};
