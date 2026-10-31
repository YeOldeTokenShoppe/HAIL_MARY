// Tech Stock — the first Asset, in the halftone poster register the Asset
// row prints in (figures are low-poly; instruments are riso). Three planes:
// the sun-and-skyline scene far back, the gold figure inside the window, and
// the rings it flies through with the cloud bank nearest — still behind the
// frame, so the clouds that run to the card's edge stay under the border. No FX.
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
    // Inside the window, behind the frame, at the size it was exported.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
    // The rings and clouds pass IN FRONT of the figure, but the sheet fills
    // the whole window, so it stays behind the plate (+44) rather than taking
    // ART_PLANES.prop: ahead of the subject by the same step the subject sits
    // ahead of the frame's own depth, drawn 1:1 so it lands where exported.
    { id: "prop", z: 0, scale: 1 },
  ],
};
