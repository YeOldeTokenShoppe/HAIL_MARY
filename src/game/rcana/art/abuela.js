// La Abuela — the gambling grandmother. Three planes: El Sol over a blue
// field far back, Abuela with her cards just ahead of the frame, and her
// own arm on the table — glass, rings, chips — nearest.
//
// The arm IS the prop, and it joins the body at the shoulder, so the two
// planes are kept close (52 and 90) rather than the full prop rung (118):
// enough depth for the chips to lift off the card, not enough to pull the
// sleeve away from the shoulder on tilt.
// Paths are by convention: public/TCG/rcana/abuela/<id>.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  // The scene's blue, for the sliver past its edge on tilt.
  backdrop: "linear-gradient(180deg,#1b5aa0 0%,#2a7cc4 60%,#1b5aa0 100%)",

  layers: [
    { id: "scene", scale: 1.04 },
    // Inside the window but on the frame's near side, so her arm can sit in
    // front of her without crossing the plate's depth between them.
    { id: "subject", z: ART_PLANES.figureFront, scale: 1 },
    { id: "prop", z: ART_PLANES.figureFront + 38, scale: 1 },
  ],
};
