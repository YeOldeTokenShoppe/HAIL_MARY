// Tech Stock — the first Asset, in the halftone poster register the Asset
// row prints in (figures are low-poly; instruments are riso). Two planes:
// a chip-sun over pink clouds far back, a midground prop between, the laptop
// with its green candles in the window. No FX.
//
// Paths are by convention: public/TCG/rcana/tech-stock/<id>.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  // The scene's own teal, for the sliver past its edge on tilt. No blur on
  // this one: the halftone IS the texture, and softening it would muddy the
  // dots into noise.
  backdrop: "linear-gradient(180deg,#1f6a7a 0%,#2a8a93 60%,#f2a8a0 100%)",

  layers: [
    { id: "scene", scale: 1.04 },
    // Midground: between the clouds and the laptop, still behind the frame.
    // No named rung sits there, so the depth is given outright — halfway
    // between scene (-68) and subject (-22).
    { id: "prop", z: -45, scale: 1.02 },
    // Inside the window, behind the frame, at the size it was exported.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
